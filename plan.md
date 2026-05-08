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

### Import and refresh
- Perform a one-time import from the current localStorage data.
- Existing local playlists import as one source each unless the legacy data already has explicit source boundaries.
- Keep the old localStorage data as a fallback copy for one release cycle.
- Normalize imported data immediately during import.
- Auto-refresh imported JSON sources on load.
- Also provide a manual `Refresh source` button.
- Refresh should load only the last-opened source immediately, with other sources fetched lazily on demand.
- If refresh fails, keep the cached version and show a non-blocking warning.
- When refresh data is unchanged, do not store a new snapshot.
- Keep one snapshot per source refresh, based on canonicalized normalized payload data.
- Retain at most `10` unique snapshots per source.
- Store raw upstream payload snapshots per source refresh, not per episode.

### Banner and metadata
- Banner images are derived automatically from imported JSON metadata.
- If a playlist has two sources, use source one, then source two, then fallback.
- If no source image exists, generate a deterministic gradient banner using the title or initials.
- Manual banner override is allowed.
- `sourceTitle` is also editable manually.

### Editor and data management
- Keep a structured editor as the primary workflow.
- Keep a raw import/export fallback for advanced use.
- The editor can create a blank playlist.
- A blank playlist starts empty, then opens immediately in edit mode.
- Add sources inline on the playlist detail page.
- New sources start blank.
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

## Implementation Checklist

### 1. Project scaffold
- [ ] Initialize the latest `Next.js` app router project in the current directory.
- [ ] Convert the codebase to `TypeScript`.
- [ ] Add `Drizzle`, `Neon`, and the minimum database tooling needed for schema and migrations.
- [ ] Set up environment variables for Neon, deployment, and the admin secret.
- [ ] Add a shared app-wide color token layer for dark mode now and light mode later.

### 2. Database schema
- [ ] Create Postgres tables for `playlists`, `sources`, `episodes`, `source_refresh_snapshots`, and any small supporting tables needed for pins, trash, and mutation logs.
- [ ] Use `uuid` primary keys generated by Postgres.
- [ ] Add `schemaVersion` to playlist records.
- [ ] Add `lastPlayedAt`, `lastPlayedSourceId`, `lastPlayedEpisodeKey`, and `lastPlayTimestamp` fields in Neon.
- [ ] Store source-level playback state inline on the `sources` table.
- [ ] Add soft-delete fields and trash timestamps to the content tables.
- [ ] Add optimistic concurrency fields so saves can reject stale edits.

### 3. Import and migration
- [ ] Build a one-time import path that reads the legacy localStorage data on first launch.
- [ ] Normalize imported playlists immediately into the new schema.
- [ ] Import each legacy playlist as one source unless the old data already has explicit source boundaries.
- [ ] Keep the old localStorage data as a fallback copy for one release cycle.
- [ ] Add canonical hashing for source refresh payloads so unchanged refreshes are skipped.
- [ ] Keep only the latest `10` unique snapshots per source.

### 4. Public home page
- [ ] Build the server-rendered playlist grid page.
- [ ] Sort playlists by `lastPlayedAt` descending, then pinned playlists, then the remaining items.
- [ ] Add client-side search and relevance re-ranking.
- [ ] Show playlist title, banner image, and subtle last-played hint on each card.
- [ ] Add a visible admin unlock button in the home page header.
- [ ] Add a small loading skeleton for initial page render.

### 5. Admin unlock flow
- [ ] Build the unlock modal/popup.
- [ ] Store the admin secret in `localStorage` after unlock, as decided.
- [ ] Validate the secret directly on write actions.
- [ ] Gate all mutation UI and server actions behind the unlock state.
- [ ] Add a manual lock/clear action in the UI.

### 6. Playlist detail route
- [ ] Add `/playlist/[id]` as the main detail route.
- [ ] Restore the selected source and episode from the URL.
- [ ] Update the URL when the user switches source or episode.
- [ ] Keep the page playback-first with an editor drawer.
- [ ] Add the source switcher with counts and status badges.
- [ ] Add a compact list view and a grid view for episodes.
- [ ] Remember the last chosen episode view per source in `localStorage`.

### 7. Playback and resume
- [ ] Resume the last played source and episode automatically when a playlist opens.
- [ ] Auto-start playback when the browser allows it.
- [ ] Leave the page unchanged if autoplay is blocked.
- [ ] Save playback progress to Neon every minute while watching.
- [ ] Stop autosaving on pause, source switch, navigation away, and tab close.
- [ ] Track playback per episode using stable `episodeKey` values.
- [ ] Show a lightweight toast when the requested episode index does not exist in the selected source.

### 8. Sources and episodes
- [ ] Support multiple separated sources per playlist.
- [ ] Keep imported source order unchanged.
- [ ] Make source titles and source URLs editable in place.
- [ ] Add a separate `Create New Source` action that starts blank.
- [ ] Keep source episodes read-only except for refresh/replacement from the source URL.
- [ ] Add a manual `Refresh source` button.
- [ ] Load the last-opened source first and fetch other sources lazily on demand.
- [ ] Keep failed source imports visible with an error badge and retry action.

### 9. Banner and metadata
- [ ] Derive playlist banners automatically from imported JSON metadata.
- [ ] Prefer source one image, then source two, then fallback.
- [ ] Add deterministic gradient fallback banners based on title or initials.
- [ ] Allow manual banner override.
- [ ] Preserve editable `sourceTitle` values separately from imported source metadata.

### 10. Search and ordering
- [ ] Make search/filter client-side over the full fetched playlist list.
- [ ] Search playlist titles, source titles, and imported metadata.
- [ ] Keep the filtered result at the playlist level.
- [ ] Re-rank search results by relevance while preserving pinned priority within the same relevance tier.

### 11. Edit, trash, and recovery
- [ ] Keep a structured editor as the default workflow.
- [ ] Add a raw import/export fallback panel for advanced use.
- [ ] Add a blank playlist creation flow.
- [ ] Add a trash route/page for soft-deleted content.
- [ ] Restore items to their original position and state.
- [ ] Auto-purge trash after `30` days.
- [ ] Keep a small admin-area mutation log.

### 12. Verification
- [ ] Verify the current localStorage import path with existing playlists.
- [ ] Verify source refresh dedupe and snapshot retention.
- [ ] Verify last-played ordering and pinned ordering on the home grid.
- [ ] Verify URL restore for playlist, source, and episode.
- [ ] Verify autoplay fallback behavior in browsers that block autoplay.
- [ ] Verify conflict handling when two tabs try to save the same playlist or source.
- [ ] Verify the unlock gate blocks mutations but not public viewing.
- [ ] Verify the trash restore flow and auto-purge behavior.

## Milestone-Sized Phases

### Phase 1: Foundation
Goal: get the new app booting on the latest `Next.js` stack with database access in place.
- Scaffold the app router project in the current directory.
- Convert the app to `TypeScript`.
- Add `Drizzle` and Neon database wiring.
- Set up environment variables.
- Add the shared dark-mode token system.

Exit criteria:
- The app builds and runs locally.
- The Neon connection works.
- The project has a basic theme/token foundation.

### Phase 2: Data Model and Migration
Goal: define the Neon schema and move legacy data into it once.
- Create tables for playlists, sources, episodes, snapshots, trash, and logs.
- Add `uuid` primary keys and `schemaVersion`.
- Add optimistic concurrency fields.
- Add soft-delete fields.
- Implement the one-time localStorage import.
- Normalize legacy records immediately on import.
- Keep the old localStorage data as fallback for one release cycle.

Exit criteria:
- Existing local data can be imported into Neon.
- Imported rows have stable IDs and the expected relationships.
- The schema supports the chosen restore, trash, and refresh behavior.

### Phase 3: Public Browse Experience
Goal: replace the current landing experience with the new server-rendered grid.
- Build the home page grid.
- Sort playlists by `lastPlayedAt`, then pinned order.
- Add client-side search and relevance ranking.
- Add playlist cards with title, banner, and subtle last-played hint.
- Add the unlock button and modal entry point.
- Add the loading skeleton.

Exit criteria:
- The home page shows all playlists from Neon.
- Search/filter works client-side.
- Pinned and recency ordering behave correctly.

### Phase 4: Playlist Detail and Playback
Goal: make `/playlist/[id]` the main playback surface.
- Add the playlist detail route.
- Restore source and episode from the URL.
- Add the source switcher.
- Add compact list and grid episode views.
- Add playback-first layout with the editor drawer hidden by default.
- Add auto-resume, autoplay handling, and inline toasts.
- Save playback progress to Neon on the minute and on stop events.

Exit criteria:
- A playlist can open directly to the last played source and episode.
- Switching sources updates the URL and preserves the chosen state.
- Playback state persists across reloads.

### Phase 5: Editor and Source Management
Goal: recreate the content management workflow in the browser.
- Add the shared-secret unlock flow.
- Gate all mutation UI and write actions.
- Add blank playlist creation.
- Add inline source creation.
- Support in-place source edits.
- Add manual refresh for a source.
- Keep failed imports visible with retry.
- Keep raw import/export as an advanced fallback.

Exit criteria:
- A playlist/source can be created and edited end-to-end.
- Refresh can replace source episodes in place.
- Mutation UI is blocked until the admin gate is unlocked.

### Phase 6: Recovery, Trash, and Safety
Goal: finish the content lifecycle features that make the app safe to use.
- Add soft-delete behavior for playlists, sources, and episodes.
- Add the trash route/page.
- Add restore behavior to original position and state.
- Auto-purge trash after `30` days.
- Add the mutation log for data changes.
- Add optimistic concurrency conflict handling.

Exit criteria:
- Deleted items can be restored.
- Conflicts fail cleanly with a refresh prompt.
- Trash management is functional and bounded.

### Phase 7: Polish and Verification
Goal: validate behavior and tighten any rough edges before considering the migration complete.
- Verify home ordering, pinned behavior, and search ranking.
- Verify route restore for playlist, source, and episode.
- Verify import dedupe and snapshot retention.
- Verify autoplay fallback behavior.
- Verify admin unlock persistence and write blocking.
- Verify trash restore and purge behavior.
- Verify keyboard shortcuts and fullscreen playback parity.

Exit criteria:
- Core user flows match the current app’s behavior.
- The migration is stable enough to use as the primary version.
- Remaining work is limited to polish, not core functionality.