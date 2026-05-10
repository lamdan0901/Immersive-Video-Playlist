# Immersive Video Playlist Migration Spec

## Goal

Move the current website to the latest `Next.js` app router stack and store data in Neon Postgres instead of local storage, while keeping the current playback workflow familiar.

## Finalized Decisions

### Platform and stack

- Use `Next.js` App Router with `TypeScript`.
- Use `Drizzle` for PostgreSQL access.
- Deploy on `Vercel` with `Neon`.
- Use server actions for mutations and server-side rendering for the home page.

### Public app behavior

- No user accounts.
- Viewing stays public.
- Writes are protected by a lightweight shared-secret admin gate.
- The unlock control lives on the home page and opens a dedicated modal/popup.
- The unlocked admin state persists in `localStorage` until manually cleared.
- The admin secret itself is also stored in `localStorage`, with direct validation on write actions.

### Home page

- Show a grid of playlists on first load.
- Sort playlists by `lastPlayedAt` descending.
- Pinned playlists appear immediately after the last-played item.
- Pinned order is custom and stable.
- The home page shows playlist title, banner image, and a subtle last-played hint.
- Search/filter is client-side, across all fetched playlists.
- Search results are re-ranked by relevance.
- Home data loads with a small skeleton while the server response is pending.

### Playlist navigation and detail route

- Use a dedicated detail route: `/playlist/[id]`.
- Preserve the selected source and episode in the URL using query params, for example `?source=[sourceId]&episode=[episodeIndex]`.
- The detail page is playback-first, with the editor available behind a collapsible drawer.
- The source switcher should be visible on the detail page.
- Source switching updates the URL and browser history.
- If the current episode does not exist in the new source, do nothing and show a lightweight inline toast.
- The toast auto-dismisses and is reused for other non-blocking notices.

### Playlist and source model

- A playlist can have many sources.
- Sources stay separate, with ordered episodes in each source.
- The imported order is preserved.
- A playlist opens to the last-opened source.
- The playlist and source restore behavior should use the last played source and episode from Neon.
- Each source has:
  - immutable `sourceKey`
  - editable `sourceTitle`
  - editable `sourceUrl`
  - `preferredLinkType`
  - playback state
  - ordered episodes
- A source can be edited in place.
- A separate `Create New Source` button creates a blank new source.
- Source playback state is stored inline on the source row.
- Episode rows are read-only except for refresh/replacement from the source URL.

### Episode behavior

- Episodes are source-specific only.
- Do not create a shared cross-source episode library.
- Use a stable `episodeKey` for refresh matching.
- Prefer the upstream `slug` when available.
- Otherwise fall back to a normalized episode number plus the source key.
- If a refresh removes an episode, soft-delete it.
- Hidden soft-deleted episodes belong in a separate trash/history view.

### Playback and resume

- Last played source, episode, and last play timestamp are stored in Neon.
- The last play timestamp is saved every minute while watching.
- Do not save if the timestamp has not changed.
- Treat pause, source switch, navigation away, and tab close as stop-watching events.
- When a playlist opens, auto-resume the last played source and episode.
- Auto-start playback if the browser allows it.
- If autoplay is blocked, do nothing and keep the page as-is.
- Track last play per episode within each source, using the stable `episodeKey`.
- If the browser is watching a source and the same episode continues, keep the current episode index when possible.
- If the current episode index does not exist in the new source, show a toast rather than forcing a fallback.

### Banner and metadata

- Banner images are derived automatically from imported JSON metadata.
- If a playlist has two sources, use source one, then source two, then fallback.
- If no source image exists, generate a deterministic gradient banner using the title or initials.
- Manual banner override is allowed.
- `sourceTitle` is also editable manually.

### Editor and data management

- A blank playlist starts empty, then opens immediately in edit mode.
- Sources import episodes immediately after creation.
- If source import fails, keep the source as a failed draft with retry.
- Failed imports stay visible in the playlist detail page with an error badge.
- Add a separate trash route/page.
- Soft-delete items first, then auto-purge trash after `30` days.
- Restore items to their original position and state.
- Add a small admin-area change log for data mutations only.

### Concurrency and safety

- Use optimistic concurrency control.
- If a conflict is detected, block the save and ask the user to refresh.
- Keep the conflict message simple.
- No auto-merge for conflicts.

### Search and filtering

- Search is client-side.
- Search should cover playlist title, source titles, and imported metadata.
- Filter results stay at the playlist level.
- Relevance re-ranking is enabled.
- Pinned playlists still stay ahead of other matches within the same relevance tier.

### UI preferences

- Dark-only for now.
- THE UI OF PLAYLIST DETAIL PAGE MUST STAY EXACT THE SAME AS LEGACY UI FOR NOW WITH FULL WIDTH AND HEIGHT VIDEO PLAYER
- Use color tokens instead of hard-coded colors so light mode can be added later.
- Keep keyboard shortcuts and fullscreen playback behavior aligned with the current site.
- Support both compact list and grid views for episodes.
- Default to the compact list and remember the last chosen view per source in `localStorage`.

## Data Model Notes

- Use Postgres `uuid` primary keys.
- Use a `schemaVersion` field on playlist records.
- Preserve source order and episode order.
- Keep episode-level playback state stable across refreshes.
- Source and episode rows should remain easy to extend without changing the public workflow.

## Important Concerns and Recommendations

### 1. Shared-secret storage in `localStorage`

This is simple, but it exposes the secret to anything running in the page.

Recommendation: keep it for now to match the current simplicity goal, but plan a future move to an `HttpOnly` session cookie or server-issued token before broader sharing.

### 2. Client-side search on a full playlist set

Fetching all playlists to the client is convenient, but it can become heavy if the library grows.

Recommendation: keep the home page summary-only and load source/episode detail lazily on the playlist route.

### 3. Frequent playback timestamp writes

Saving progress every minute is reasonable, but it still adds repeated writes.

Recommendation: write only when the time actually changes, and stop on pause/navigation/tab close.

### 4. Refresh-generated snapshots

Refreshing sources and storing snapshots is useful, but history can grow quickly.

Recommendation: keep the `10`-snapshot cap per source and dedupe via canonical hashing as already decided.

### 5. Source editing and raw import/export

The app is becoming structured, but it still needs an escape hatch for bulk fixes.

Recommendation: keep the structured editor primary and hide raw JSON under an advanced fallback so the default path stays safe and simple.

### 6. Public viewing with gated writes

Public viewing plus a shared-secret write gate is fine for a personal app, but it is not strong security.

Recommendation: keep it for now, but avoid exposing the secret anywhere except the admin unlock flow and write checks.

## Open Implementation Reminder

- The current `index.html` static app is the legacy source of truth.
- The migration should preserve the familiar user flow, then replace the local storage implementation with Neon-backed data.
