# Next Neon Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the static immersive video playlist app to a Next.js App Router TypeScript app backed by Neon Postgres, while preserving the current playback workflow.

**Architecture:** Build a server-rendered playlist home page and a playback-first `/playlist/[id]` detail route. Store playlists, sources, episodes, playback state, trash, source snapshots, and mutation logs in Postgres through Drizzle; use server actions for all writes behind a shared-secret admin gate. Keep legacy UI behavior in focused client components that receive server data and call server actions only for mutations.

**Tech Stack:** Next.js App Router, TypeScript, React, Drizzle ORM, Neon Postgres, Vitest, Testing Library, Playwright, hls.js, Vercel.

---

## Scope Check

This migration covers one product surface, but it has several dependent layers: scaffold, data model, import logic, admin gate, home route, detail route, playback persistence, editor, trash, changelog, and deployment. Keep this as one plan because each phase produces a working slice of the same app and shares the same schema.

## Current Legacy Source

- `index.html`: static app and source of truth for playback UI, panels, shortcuts, JSON import, localStorage state, HLS/native video behavior, and iframe behavior.
- `sample1.json`: OPhim-shaped import sample. Uses `data.item.episodes[].server_data[]`.
- `sample2.json`: NguonC-shaped import sample. Uses `movie.episodes[].items[]`.
- `plan.md`: migration spec.

## Target File Structure

- Create: `package.json` - app scripts and dependencies.
- Create: `next.config.ts` - Next config.
- Create: `tsconfig.json` - TypeScript config.
- Create: `vitest.config.ts` - unit test config.
- Create: `playwright.config.ts` - browser test config.
- Create: `.env.example` - required environment variables.
- Create: `drizzle.config.ts` - Drizzle migration config.
- Create: `src/app/layout.tsx` - root metadata and global shell.
- Create: `src/app/globals.css` - dark tokens and legacy-compatible player/editor styles.
- Create: `src/app/page.tsx` - server-rendered home route.
- Create: `src/app/playlist/[id]/page.tsx` - server-rendered detail route.
- Create: `src/app/trash/page.tsx` - trash route.
- Create: `src/components/admin/admin-unlock-modal.tsx` - localStorage admin unlock UI.
- Create: `src/components/home/playlist-home-client.tsx` - client search/filter/ranking.
- Create: `src/components/home/playlist-card.tsx` - playlist summary card.
- Create: `src/components/playlist/playlist-detail-client.tsx` - playback-first route client.
- Create: `src/components/playlist/player-stage.tsx` - iframe/native HLS playback surface.
- Create: `src/components/playlist/editor-drawer.tsx` - admin editor drawer.
- Create: `src/components/playlist/source-switcher.tsx` - source selector and URL update.
- Create: `src/components/playlist/episode-list.tsx` - compact/grid episode chooser.
- Create: `src/components/playlist/toast.tsx` - lightweight inline toast.
- Create: `src/components/trash/trash-client.tsx` - restore/permanent delete UI.
- Create: `src/db/schema.ts` - Drizzle tables and relations.
- Create: `src/db/client.ts` - Neon Drizzle client.
- Create: `src/db/queries/home.ts` - home summary reads.
- Create: `src/db/queries/playlist.ts` - detail reads and mutation helpers.
- Create: `src/db/queries/trash.ts` - trash reads.
- Create: `src/lib/admin.ts` - shared-secret verification helpers.
- Create: `src/lib/banner.ts` - source-image and gradient banner selection.
- Create: `src/lib/importers.ts` - OPhim/NguonC import normalization.
- Create: `src/lib/relevance.ts` - client search ranking.
- Create: `src/lib/playback.ts` - playback state utilities.
- Create: `src/lib/source-refresh.ts` - episode matching, soft-delete, snapshots.
- Create: `src/lib/types.ts` - shared TypeScript types.
- Create: `src/actions/admin.ts` - admin unlock validation action.
- Create: `src/actions/playback.ts` - playback persistence actions.
- Create: `src/actions/playlists.ts` - playlist/source/editor/trash actions.
- Create: `src/actions/import.ts` - source import and refresh actions.
- Create: `src/test/fixtures/sample-ophim.json` - copy of `sample1.json`.
- Create: `src/test/fixtures/sample-nguonc.json` - copy of `sample2.json`.
- Create: `src/test/setup.ts` - Vitest DOM setup.
- Create: `src/lib/importers.test.ts` - import parser tests.
- Create: `src/lib/relevance.test.ts` - search rank tests.
- Create: `src/lib/source-refresh.test.ts` - refresh reconciliation tests.
- Create: `src/lib/banner.test.ts` - banner tests.
- Create: `src/lib/playback.test.ts` - playback utility tests.
- Create: `tests/e2e/playback.spec.ts` - route and playback smoke tests.
- Modify: `favicon.png` - keep file and move/copy into `public/favicon.png` during scaffold.
- Leave: `index.html` - keep as migration reference until final parity is verified.

## Task 1: Scaffold Next App

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `.env.example`
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`
- Create: `src/test/setup.ts`
- Create: `public/favicon.png`

- [ ] **Step 1: Create package manifest**

Write `package.json`:

```json
{
  "private": true,
  "name": "immersive-video-playlist",
  "version": "0.1.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "@neondatabase/serverless": "latest",
    "drizzle-orm": "latest",
    "hls.js": "latest",
    "lucide-react": "latest",
    "next": "latest",
    "react": "latest",
    "react-dom": "latest",
    "server-only": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "@playwright/test": "latest",
    "@testing-library/jest-dom": "latest",
    "@testing-library/react": "latest",
    "@types/node": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "@vitejs/plugin-react": "latest",
    "drizzle-kit": "latest",
    "jsdom": "latest",
    "typescript": "latest",
    "vitest": "latest"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`

Expected: `package-lock.json` is created and install exits with code `0`.

- [ ] **Step 3: Add TypeScript and tool config**

Write `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Write `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb"
    }
  }
};

export default nextConfig;
```

Write `vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    globals: true
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname
    }
  }
});
```

Write `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true
  },
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry"
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium", viewport: { width: 1280, height: 720 } } },
    { name: "mobile", use: { browserName: "chromium", viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true } }
  ]
});
```

Write `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Add environment example**

Write `.env.example`:

```bash
DATABASE_URL="postgresql://user:password@ep-example.neon.tech/neondb?sslmode=require"
ADMIN_SECRET="change-me"
NEXT_PUBLIC_APP_NAME="Immersive Video Playlist"
```

- [ ] **Step 5: Add initial app shell**

Write `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Immersive Video Playlist",
  description: "Public immersive video playlists with admin-gated edits."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

Write `src/app/globals.css` with dark tokens and the legacy player baseline:

```css
:root {
  color-scheme: dark;
  --color-bg: #0f0f0f;
  --color-panel: rgba(15, 15, 15, 0.95);
  --color-surface: #181818;
  --color-surface-hover: #242424;
  --color-border: #333;
  --color-text: #fff;
  --color-muted: #888;
  --color-accent: #3b82f6;
  --color-danger: #ef4444;
  --shadow-panel: 0 20px 60px rgba(0, 0, 0, 0.45);
}

* {
  box-sizing: border-box;
}

html,
body {
  width: 100%;
  min-height: 100%;
  margin: 0;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: Segoe UI, Tahoma, Geneva, Verdana, sans-serif;
}

button,
input,
textarea,
select {
  font: inherit;
}

.fullscreen-wrapper {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #000;
}

.fullscreen-wrapper iframe,
.fullscreen-wrapper video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  background: #000;
}
```

Copy `favicon.png` to `public/favicon.png`.

- [ ] **Step 6: Run scaffold verification**

Run: `npm run test`

Expected: PASS with no test files or setup errors.

Run: `npm run build`

Expected: FAIL only if `src/app/page.tsx` is missing. If Next requires a root page at this point, create `src/app/page.tsx` with:

```tsx
export default function HomePage() {
  return <main>Immersive Video Playlist</main>;
}
```

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json next.config.ts tsconfig.json vitest.config.ts playwright.config.ts .env.example src public
git commit -m "chore: scaffold next app"
```

## Task 2: Import Normalization

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/importers.ts`
- Create: `src/lib/importers.test.ts`
- Create: `src/test/fixtures/sample-ophim.json`
- Create: `src/test/fixtures/sample-nguonc.json`

- [ ] **Step 1: Copy import fixtures**

Copy `sample1.json` to `src/test/fixtures/sample-ophim.json`.

Copy `sample2.json` to `src/test/fixtures/sample-nguonc.json`.

- [ ] **Step 2: Write failing importer tests**

Write `src/lib/importers.test.ts`:

```ts
import ophim from "@/test/fixtures/sample-ophim.json";
import nguonc from "@/test/fixtures/sample-nguonc.json";
import { makeEpisodeKey, normalizeImportedMovie } from "./importers";

describe("normalizeImportedMovie", () => {
  it("normalizes OPhim source data", () => {
    const movie = normalizeImportedMovie(ophim, "https://ophim1.com/v1/api/phim/giai-ngau-thien-thanh");

    expect(movie.title).toBe("Giai Ngẫu Thiên Thành");
    expect(movie.sources).toHaveLength(2);
    expect(movie.sources[0].sourceTitle).toBe("Vietsub #1");
    expect(movie.sources[0].episodes[0]).toMatchObject({
      episodeKey: "1",
      title: "1",
      embedUrl: "https://vip.opstream90.com/share/b453b5a7a737a3fc489fa11aaac1618b"
    });
    expect(movie.imageUrl).toContain("giai-ngau-thien-thanh-thumb.jpg");
  });

  it("normalizes NguonC source data", () => {
    const movie = normalizeImportedMovie(nguonc, "https://phim.nguonc.com/api/film/vuong-mien-hoan-hao");

    expect(movie.title).toBe("Vương Miện Hoàn Hảo");
    expect(movie.sources).toHaveLength(1);
    expect(movie.sources[0].sourceTitle).toBe("Vietsub #1");
    expect(movie.sources[0].episodes[0]).toMatchObject({
      episodeKey: "tap-1",
      title: "1",
      embedUrl: "https://embed13.streamc.xyz/embed.php?hash=05d1260ef455a2305874f749a8294a36"
    });
    expect(movie.imageUrl).toContain("vuong-mien-hoan-hao.jpg");
  });
});

describe("makeEpisodeKey", () => {
  it("uses upstream slug when present", () => {
    expect(makeEpisodeKey({ slug: "tap-12", name: "12" }, "source-a")).toBe("tap-12");
  });

  it("falls back to normalized episode number plus source key", () => {
    expect(makeEpisodeKey({ name: "Tập 12" }, "source-a")).toBe("source-a:12");
  });
});
```

- [ ] **Step 3: Run importer test to verify it fails**

Run: `npm run test -- src/lib/importers.test.ts`

Expected: FAIL with `Cannot find module './importers'`.

- [ ] **Step 4: Implement shared types**

Write `src/lib/types.ts`:

```ts
export type LinkType = "m3u8" | "embed";

export type ImportedEpisode = {
  episodeKey: string;
  title: string;
  slug: string | null;
  filename: string | null;
  embedUrl: string | null;
  m3u8Url: string | null;
};

export type ImportedSource = {
  sourceKey: string;
  sourceTitle: string;
  sourceUrl: string;
  preferredLinkType: LinkType;
  episodes: ImportedEpisode[];
};

export type ImportedMovie = {
  title: string;
  slug: string | null;
  imageUrl: string | null;
  posterUrl: string | null;
  metadata: Record<string, unknown>;
  sources: ImportedSource[];
};
```

- [ ] **Step 5: Implement importer**

Write `src/lib/importers.ts`:

```ts
import type { ImportedEpisode, ImportedMovie, ImportedSource, LinkType } from "./types";

type RawEpisode = {
  name?: unknown;
  slug?: unknown;
  filename?: unknown;
  link_embed?: unknown;
  link_m3u8?: unknown;
  embed?: unknown;
  m3u8?: unknown;
};

type RawServer = {
  server_name?: unknown;
  server_data?: RawEpisode[];
  items?: RawEpisode[];
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeNumber(value: string): string {
  const match = value.match(/\d+(?:\.\d+)?/);
  return match ? match[0] : value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function absoluteImage(url: string | null, cdn: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (!cdn) return url;
  return `${cdn.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
}

export function makeEpisodeKey(episode: { slug?: unknown; name?: unknown }, sourceKey: string): string {
  const slug = asString(episode.slug);
  if (slug) return slug;
  const name = asString(episode.name) ?? "episode";
  return `${sourceKey}:${normalizeNumber(name)}`;
}

function normalizeEpisodes(rows: RawEpisode[], sourceKey: string): ImportedEpisode[] {
  return rows.map((episode, index) => {
    const title = asString(episode.name) ?? `${index + 1}`;
    return {
      episodeKey: makeEpisodeKey(episode, sourceKey),
      title,
      slug: asString(episode.slug),
      filename: asString(episode.filename),
      embedUrl: asString(episode.link_embed) ?? asString(episode.embed),
      m3u8Url: asString(episode.link_m3u8) ?? asString(episode.m3u8)
    };
  });
}

function normalizeServers(servers: RawServer[], sourceUrl: string): ImportedSource[] {
  return servers.map((server, index) => {
    const sourceTitle = asString(server.server_name) ?? `Source ${index + 1}`;
    const sourceKey = sourceTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `source-${index + 1}`;
    const rows = Array.isArray(server.server_data) ? server.server_data : Array.isArray(server.items) ? server.items : [];
    const preferredLinkType: LinkType = rows.some((row) => asString(row.link_m3u8) ?? asString(row.m3u8)) ? "m3u8" : "embed";

    return {
      sourceKey,
      sourceTitle,
      sourceUrl,
      preferredLinkType,
      episodes: normalizeEpisodes(rows, sourceKey)
    };
  });
}

export function normalizeImportedMovie(data: unknown, sourceUrl: string): ImportedMovie {
  const record = data as Record<string, unknown>;
  const isNguonC = sourceUrl.includes("phim.nguonc.com");
  const isOPhim = sourceUrl.includes("ophim1.com");
  const item = (isNguonC ? record.movie : isOPhim ? (record.data as Record<string, unknown> | undefined)?.item : null) as Record<string, unknown> | null;

  if (!item) {
    throw new Error("Unsupported import response");
  }

  const rawServers = Array.isArray(item.episodes) ? (item.episodes as RawServer[]) : [];
  const cdn = asString(record.APP_DOMAIN_CDN_IMAGE);
  const imageUrl = absoluteImage(asString(item.thumb_url), cdn);
  const posterUrl = absoluteImage(asString(item.poster_url), cdn);

  return {
    title: asString(item.name) ?? "Untitled Playlist",
    slug: asString(item.slug),
    imageUrl,
    posterUrl,
    metadata: item,
    sources: normalizeServers(rawServers, sourceUrl)
  };
}
```

- [ ] **Step 6: Run importer tests**

Run: `npm run test -- src/lib/importers.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts src/lib/importers.ts src/lib/importers.test.ts src/test/fixtures
git commit -m "feat: normalize imported playlist sources"
```

## Task 3: Database Schema

**Files:**
- Create: `drizzle.config.ts`
- Create: `src/db/schema.ts`
- Create: `src/db/client.ts`

- [ ] **Step 1: Add Drizzle config**

Write `drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? ""
  }
});
```

- [ ] **Step 2: Write schema**

Write `src/db/schema.ts`:

```ts
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

export const linkTypeEnum = pgEnum("link_type", ["m3u8", "embed"]);
export const trashKindEnum = pgEnum("trash_kind", ["playlist", "source", "episode"]);
export const mutationKindEnum = pgEnum("mutation_kind", [
  "playlist.create",
  "playlist.update",
  "playlist.delete",
  "source.create",
  "source.update",
  "source.refresh",
  "source.delete",
  "episode.restore",
  "trash.purge",
  "playback.update"
]);

export const playlists = pgTable("playlists", {
  id: uuid("id").primaryKey().defaultRandom(),
  schemaVersion: integer("schema_version").notNull().default(1),
  title: text("title").notNull(),
  slug: text("slug"),
  bannerOverrideUrl: text("banner_override_url"),
  derivedImageUrl: text("derived_image_url"),
  pinned: boolean("pinned").notNull().default(false),
  pinnedOrder: integer("pinned_order").notNull().default(0),
  lastPlayedAt: timestamp("last_played_at", { withTimezone: true }),
  lastPlayedSourceId: uuid("last_played_source_id"),
  lastPlayedEpisodeKey: text("last_played_episode_key"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  version: integer("version").notNull().default(1),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  purgeAfter: timestamp("purge_after", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  activeIdx: index("playlists_active_idx").on(table.deletedAt, table.lastPlayedAt),
  pinnedIdx: index("playlists_pinned_idx").on(table.pinned, table.pinnedOrder)
}));

export const sources = pgTable("sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  playlistId: uuid("playlist_id").notNull().references(() => playlists.id),
  sourceKey: text("source_key").notNull(),
  sourceTitle: text("source_title").notNull(),
  sourceUrl: text("source_url").notNull(),
  preferredLinkType: linkTypeEnum("preferred_link_type").notNull().default("m3u8"),
  sortOrder: integer("sort_order").notNull().default(0),
  lastPlayedEpisodeKey: text("last_played_episode_key"),
  lastPlayedSeconds: integer("last_played_seconds").notNull().default(0),
  lastPlayedAt: timestamp("last_played_at", { withTimezone: true }),
  importError: text("import_error"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  version: integer("version").notNull().default(1),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  purgeAfter: timestamp("purge_after", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  sourceKeyUnique: uniqueIndex("sources_playlist_source_key_unique").on(table.playlistId, table.sourceKey),
  playlistOrderIdx: index("sources_playlist_order_idx").on(table.playlistId, table.sortOrder)
}));

export const episodes = pgTable("episodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceId: uuid("source_id").notNull().references(() => sources.id),
  episodeKey: text("episode_key").notNull(),
  title: text("title").notNull(),
  slug: text("slug"),
  filename: text("filename"),
  embedUrl: text("embed_url"),
  m3u8Url: text("m3u8_url"),
  sortOrder: integer("sort_order").notNull(),
  lastPlayedSeconds: integer("last_played_seconds").notNull().default(0),
  lastPlayedAt: timestamp("last_played_at", { withTimezone: true }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  purgeAfter: timestamp("purge_after", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  episodeKeyUnique: uniqueIndex("episodes_source_episode_key_unique").on(table.sourceId, table.episodeKey),
  sourceOrderIdx: index("episodes_source_order_idx").on(table.sourceId, table.sortOrder)
}));

export const sourceSnapshots = pgTable("source_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceId: uuid("source_id").notNull().references(() => sources.id),
  canonicalHash: text("canonical_hash").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  sourceHashUnique: uniqueIndex("source_snapshots_source_hash_unique").on(table.sourceId, table.canonicalHash)
}));

export const mutationLogs = pgTable("mutation_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: mutationKindEnum("kind").notNull(),
  entityId: uuid("entity_id"),
  summary: text("summary").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const playlistsRelations = relations(playlists, ({ many }) => ({
  sources: many(sources)
}));

export const sourcesRelations = relations(sources, ({ one, many }) => ({
  playlist: one(playlists, { fields: [sources.playlistId], references: [playlists.id] }),
  episodes: many(episodes)
}));

export const episodesRelations = relations(episodes, ({ one }) => ({
  source: one(sources, { fields: [episodes.sourceId], references: [sources.id] })
}));

export const thirtyDaysFromNow = sql`now() + interval '30 days'`;
```

- [ ] **Step 3: Add DB client**

Write `src/db/client.ts`:

```ts
import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const sql = neon(process.env.DATABASE_URL);

export const db = drizzle(sql, { schema });
```

- [ ] **Step 4: Generate migration**

Run: `npm run db:generate`

Expected: migration SQL file appears in `drizzle/` and contains tables `playlists`, `sources`, `episodes`, `source_snapshots`, and `mutation_logs`.

- [ ] **Step 5: Commit**

```bash
git add drizzle.config.ts src/db drizzle
git commit -m "feat: add postgres schema"
```

## Task 4: Admin Gate and Mutation Logging

**Files:**
- Create: `src/lib/admin.ts`
- Create: `src/actions/admin.ts`
- Create: `src/actions/playlists.ts`

- [ ] **Step 1: Write admin helper**

Write `src/lib/admin.ts`:

```ts
import "server-only";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; conflict?: boolean };

export function assertAdminSecret(secret: string | null | undefined): ActionResult {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    return { ok: false, error: "ADMIN_SECRET is not configured" };
  }

  if (!secret || secret !== expected) {
    return { ok: false, error: "Admin unlock required" };
  }

  return { ok: true, data: undefined };
}
```

- [ ] **Step 2: Write unlock action**

Write `src/actions/admin.ts`:

```ts
"use server";

import { assertAdminSecret, type ActionResult } from "@/lib/admin";

export async function validateAdminSecret(secret: string): Promise<ActionResult> {
  return assertAdminSecret(secret);
}
```

- [ ] **Step 3: Add mutation log helper**

Start `src/actions/playlists.ts` with:

```ts
"use server";

import { db } from "@/db/client";
import { mutationLogs } from "@/db/schema";
import { assertAdminSecret, type ActionResult } from "@/lib/admin";

export async function logMutation(kind: typeof mutationLogs.$inferInsert.kind, summary: string, entityId?: string) {
  await db.insert(mutationLogs).values({ kind, summary, entityId });
}

export async function verifyWrite(secret: string): Promise<ActionResult> {
  return assertAdminSecret(secret);
}
```

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: PASS or only fails because pages still import missing future modules. If it fails for missing future modules, proceed and re-run after Task 5.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin.ts src/actions/admin.ts src/actions/playlists.ts
git commit -m "feat: add shared secret admin gate"
```

## Task 5: Home Reads, Banners, and Search Ranking

**Files:**
- Create: `src/db/queries/home.ts`
- Create: `src/lib/banner.ts`
- Create: `src/lib/banner.test.ts`
- Create: `src/lib/relevance.ts`
- Create: `src/lib/relevance.test.ts`
- Create: `src/components/admin/admin-unlock-modal.tsx`
- Create: `src/components/home/playlist-card.tsx`
- Create: `src/components/home/playlist-home-client.tsx`
- Create: `src/app/page.tsx`

- [ ] **Step 1: Write banner and ranking tests**

Write `src/lib/banner.test.ts`:

```ts
import { chooseBanner } from "./banner";

it("uses manual override first", () => {
  expect(chooseBanner({ title: "A", bannerOverrideUrl: "https://x.test/a.jpg", derivedImageUrl: "https://x.test/b.jpg", sourceImages: [] })).toEqual({
    type: "image",
    value: "https://x.test/a.jpg"
  });
});

it("uses first source image before second source image", () => {
  expect(chooseBanner({ title: "A", bannerOverrideUrl: null, derivedImageUrl: null, sourceImages: ["https://x.test/1.jpg", "https://x.test/2.jpg"] })).toEqual({
    type: "image",
    value: "https://x.test/1.jpg"
  });
});

it("falls back to deterministic gradient", () => {
  expect(chooseBanner({ title: "Fate Chooses You", bannerOverrideUrl: null, derivedImageUrl: null, sourceImages: [] })).toEqual({
    type: "gradient",
    value: "linear-gradient(135deg, #14532d, #1d4ed8)",
    initials: "FC"
  });
});
```

Write `src/lib/relevance.test.ts`:

```ts
import { rankPlaylists } from "./relevance";

const rows = [
  { id: "1", title: "Fate Chooses You", sourceTitles: ["Vietsub"], metadataText: "Chinese drama", pinned: false, pinnedOrder: 0, lastPlayedAt: "2026-05-01T00:00:00.000Z" },
  { id: "2", title: "Perfect Crown", sourceTitles: ["Thuyet Minh"], metadataText: "Korean romance", pinned: true, pinnedOrder: 1, lastPlayedAt: null },
  { id: "3", title: "Crown Fate", sourceTitles: ["Vietsub"], metadataText: "romance fate", pinned: true, pinnedOrder: 0, lastPlayedAt: null }
];

it("ranks title matches and keeps pinned order within relevance tier", () => {
  expect(rankPlaylists(rows, "crown").map((row) => row.id)).toEqual(["3", "2"]);
});

it("returns all rows sorted by last played then pinned when query is empty", () => {
  expect(rankPlaylists(rows, "").map((row) => row.id)).toEqual(["1", "3", "2"]);
});
```

- [ ] **Step 2: Run tests to verify fail**

Run: `npm run test -- src/lib/banner.test.ts src/lib/relevance.test.ts`

Expected: FAIL with missing modules.

- [ ] **Step 3: Implement banner utility**

Write `src/lib/banner.ts`:

```ts
type BannerInput = {
  title: string;
  bannerOverrideUrl: string | null;
  derivedImageUrl: string | null;
  sourceImages: string[];
};

type BannerResult =
  | { type: "image"; value: string }
  | { type: "gradient"; value: string; initials: string };

const gradients = [
  "linear-gradient(135deg, #14532d, #1d4ed8)",
  "linear-gradient(135deg, #7f1d1d, #312e81)",
  "linear-gradient(135deg, #164e63, #831843)",
  "linear-gradient(135deg, #365314, #075985)"
];

export function chooseBanner(input: BannerInput): BannerResult {
  const image = input.bannerOverrideUrl ?? input.derivedImageUrl ?? input.sourceImages.find(Boolean);
  if (image) return { type: "image", value: image };

  const initials = input.title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "IV";
  const sum = Array.from(input.title).reduce((total, char) => total + char.charCodeAt(0), 0);

  return {
    type: "gradient",
    value: gradients[sum % gradients.length],
    initials
  };
}
```

- [ ] **Step 4: Implement relevance utility**

Write `src/lib/relevance.ts`:

```ts
export type SearchablePlaylist = {
  id: string;
  title: string;
  sourceTitles: string[];
  metadataText: string;
  pinned: boolean;
  pinnedOrder: number;
  lastPlayedAt: string | null;
};

function score(row: SearchablePlaylist, query: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const title = row.title.toLowerCase();
  const source = row.sourceTitles.join(" ").toLowerCase();
  const metadata = row.metadataText.toLowerCase();
  let total = 0;
  if (title === q) total += 100;
  if (title.includes(q)) total += 60;
  if (source.includes(q)) total += 30;
  if (metadata.includes(q)) total += 10;
  return total;
}

export function rankPlaylists<T extends SearchablePlaylist>(rows: T[], query: string): T[] {
  const trimmed = query.trim();

  return rows
    .map((row) => ({ row, score: score(row, trimmed) }))
    .filter((entry) => !trimmed || entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.row.pinned !== b.row.pinned) return a.row.pinned ? -1 : 1;
      if (a.row.pinned && b.row.pinned && a.row.pinnedOrder !== b.row.pinnedOrder) return a.row.pinnedOrder - b.row.pinnedOrder;
      const aTime = a.row.lastPlayedAt ? Date.parse(a.row.lastPlayedAt) : 0;
      const bTime = b.row.lastPlayedAt ? Date.parse(b.row.lastPlayedAt) : 0;
      return bTime - aTime;
    })
    .map((entry) => entry.row);
}
```

- [ ] **Step 5: Add home query**

Write `src/db/queries/home.ts`:

```ts
import { asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { episodes, playlists, sources } from "@/db/schema";
import { chooseBanner } from "@/lib/banner";
import type { SearchablePlaylist } from "@/lib/relevance";

export type PlaylistSummary = SearchablePlaylist & {
  banner: ReturnType<typeof chooseBanner>;
  updatedAt: string;
};

export async function getPlaylistSummaries(): Promise<PlaylistSummary[]> {
  const playlistRows = await db.query.playlists.findMany({
    where: isNull(playlists.deletedAt),
    orderBy: [desc(playlists.lastPlayedAt), desc(playlists.pinned), asc(playlists.pinnedOrder)],
    with: {
      sources: {
        where: isNull(sources.deletedAt),
        orderBy: [asc(sources.sortOrder)],
        with: {
          episodes: {
            where: isNull(episodes.deletedAt),
            limit: 1
          }
        }
      }
    }
  });

  return playlistRows.map((playlist) => {
    const sourceTitles = playlist.sources.map((source) => source.sourceTitle);
    const sourceImages = playlist.sources
      .map((source) => {
        const image = source.metadata.imageUrl;
        return typeof image === "string" ? image : "";
      })
      .filter(Boolean);

    return {
      id: playlist.id,
      title: playlist.title,
      sourceTitles,
      metadataText: JSON.stringify(playlist.metadata),
      pinned: playlist.pinned,
      pinnedOrder: playlist.pinnedOrder,
      lastPlayedAt: playlist.lastPlayedAt?.toISOString() ?? null,
      updatedAt: playlist.updatedAt.toISOString(),
      banner: chooseBanner({
        title: playlist.title,
        bannerOverrideUrl: playlist.bannerOverrideUrl,
        derivedImageUrl: playlist.derivedImageUrl,
        sourceImages
      })
    };
  });
}
```

- [ ] **Step 6: Add home UI**

Write `src/app/page.tsx`:

```tsx
import { Suspense } from "react";
import { getPlaylistSummaries } from "@/db/queries/home";
import { PlaylistHomeClient } from "@/components/home/playlist-home-client";

async function HomeData() {
  const playlists = await getPlaylistSummaries();
  return <PlaylistHomeClient playlists={playlists} />;
}

export default function HomePage() {
  return (
    <main className="home-page">
      <Suspense fallback={<div className="home-skeleton" aria-label="Loading playlists" />}>
        <HomeData />
      </Suspense>
    </main>
  );
}
```

Write client components with these behavior constraints:

```tsx
"use client";

import { useState } from "react";
import type { PlaylistSummary } from "@/db/queries/home";
import { rankPlaylists } from "@/lib/relevance";
import { AdminUnlockModal } from "@/components/admin/admin-unlock-modal";
import { PlaylistCard } from "./playlist-card";

export function PlaylistHomeClient({ playlists }: { playlists: PlaylistSummary[] }) {
  const [query, setQuery] = useState("");
  const [unlockOpen, setUnlockOpen] = useState(false);
  const ranked = rankPlaylists(playlists, query);

  return (
    <>
      <header className="home-toolbar">
        <h1>Immersive Video Playlist</h1>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search playlists" />
        <button type="button" onClick={() => setUnlockOpen(true)}>Unlock</button>
      </header>
      <section className="playlist-grid">
        {ranked.map((playlist) => <PlaylistCard key={playlist.id} playlist={playlist} />)}
      </section>
      <AdminUnlockModal open={unlockOpen} onClose={() => setUnlockOpen(false)} />
    </>
  );
}
```

Use `useState` only for local input/modal state. Do not use `useEffect` for derived search results.

- [ ] **Step 7: Run tests and build**

Run: `npm run test -- src/lib/banner.test.ts src/lib/relevance.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS after all imported UI files are created.

- [ ] **Step 8: Commit**

```bash
git add src/app/page.tsx src/components/admin src/components/home src/db/queries/home.ts src/lib/banner.ts src/lib/banner.test.ts src/lib/relevance.ts src/lib/relevance.test.ts
git commit -m "feat: add playlist home"
```

## Task 6: Playlist Detail Read Model and URL Restore

**Files:**
- Create: `src/db/queries/playlist.ts`
- Create: `src/lib/playback.ts`
- Create: `src/lib/playback.test.ts`
- Create: `src/app/playlist/[id]/page.tsx`

- [ ] **Step 1: Write playback utility tests**

Write `src/lib/playback.test.ts`:

```ts
import { resolveInitialPlayback, shouldSavePlayback } from "./playback";

const source = {
  id: "source-1",
  episodes: [
    { episodeKey: "ep-1" },
    { episodeKey: "ep-2" }
  ],
  lastPlayedEpisodeKey: "ep-2"
};

it("prefers query source and episode when valid", () => {
  expect(resolveInitialPlayback([source], { sourceId: "source-1", episodeIndex: "0" })).toEqual({
    sourceId: "source-1",
    episodeIndex: 0
  });
});

it("falls back to source last played episode", () => {
  expect(resolveInitialPlayback([source], { sourceId: "source-1", episodeIndex: null })).toEqual({
    sourceId: "source-1",
    episodeIndex: 1
  });
});

it("does not save unchanged timestamps", () => {
  expect(shouldSavePlayback(30, 30)).toBe(false);
  expect(shouldSavePlayback(31, 30)).toBe(true);
});
```

- [ ] **Step 2: Implement playback utilities**

Write `src/lib/playback.ts`:

```ts
type PlaybackSource = {
  id: string;
  lastPlayedEpisodeKey: string | null;
  episodes: { episodeKey: string }[];
};

export function resolveInitialPlayback(
  sources: PlaybackSource[],
  query: { sourceId: string | null; episodeIndex: string | null }
) {
  const source = sources.find((item) => item.id === query.sourceId) ?? sources[0];
  if (!source) return { sourceId: null, episodeIndex: 0 };

  const parsed = query.episodeIndex == null ? Number.NaN : Number.parseInt(query.episodeIndex, 10);
  if (Number.isInteger(parsed) && parsed >= 0 && parsed < source.episodes.length) {
    return { sourceId: source.id, episodeIndex: parsed };
  }

  const lastIndex = source.episodes.findIndex((episode) => episode.episodeKey === source.lastPlayedEpisodeKey);
  return { sourceId: source.id, episodeIndex: lastIndex >= 0 ? lastIndex : 0 };
}

export function shouldSavePlayback(nextSeconds: number, previousSeconds: number) {
  return Math.floor(nextSeconds) !== Math.floor(previousSeconds);
}
```

- [ ] **Step 3: Add detail query**

Write `src/db/queries/playlist.ts`:

```ts
import { asc, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { episodes, playlists, sources } from "@/db/schema";

export async function getPlaylistDetail(id: string) {
  const playlist = await db.query.playlists.findFirst({
    where: eq(playlists.id, id),
    with: {
      sources: {
        where: isNull(sources.deletedAt),
        orderBy: [asc(sources.sortOrder)],
        with: {
          episodes: {
            where: isNull(episodes.deletedAt),
            orderBy: [asc(episodes.sortOrder)]
          }
        }
      }
    }
  });

  if (!playlist || playlist.deletedAt) notFound();
  return playlist;
}
```

- [ ] **Step 4: Add detail route**

Write `src/app/playlist/[id]/page.tsx`:

```tsx
import { getPlaylistDetail } from "@/db/queries/playlist";
import { resolveInitialPlayback } from "@/lib/playback";
import { PlaylistDetailClient } from "@/components/playlist/playlist-detail-client";

export default async function PlaylistDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ source?: string; episode?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const playlist = await getPlaylistDetail(id);
  const initial = resolveInitialPlayback(playlist.sources, {
    sourceId: query.source ?? playlist.lastPlayedSourceId,
    episodeIndex: query.episode ?? null
  });

  return <PlaylistDetailClient playlist={playlist} initialPlayback={initial} />;
}
```

- [ ] **Step 5: Verify**

Run: `npm run test -- src/lib/playback.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/db/queries/playlist.ts src/lib/playback.ts src/lib/playback.test.ts src/app/playlist
git commit -m "feat: add playlist detail read model"
```

## Task 7: Playback-First Detail UI

**Files:**
- Create: `src/components/playlist/playlist-detail-client.tsx`
- Create: `src/components/playlist/player-stage.tsx`
- Create: `src/components/playlist/source-switcher.tsx`
- Create: `src/components/playlist/episode-list.tsx`
- Create: `src/components/playlist/toast.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Implement toast**

Write `src/components/playlist/toast.tsx`:

```tsx
"use client";

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="inline-toast" role="status">{message}</div>;
}
```

- [ ] **Step 2: Implement player stage**

Write `src/components/playlist/player-stage.tsx`:

```tsx
"use client";

import Hls from "hls.js";
import { useRef, useEffect } from "react";

type Episode = {
  episodeKey: string;
  title: string;
  embedUrl: string | null;
  m3u8Url: string | null;
  lastPlayedSeconds: number;
};

function isM3u8(url: string | null) {
  return Boolean(url && /\.m3u8(\?|$)/i.test(url));
}

export function PlayerStage({
  episode,
  preferredLinkType,
  onStopWatching
}: {
  episode: Episode | null;
  preferredLinkType: "m3u8" | "embed";
  onStopWatching: (seconds: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const url = preferredLinkType === "embed" ? episode?.embedUrl ?? episode?.m3u8Url : episode?.m3u8Url ?? episode?.embedUrl;
  const useNative = isM3u8(url);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url || !useNative) return;

    let hls: Hls | null = null;
    if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
    }

    const onLoadedMetadata = () => {
      if (episode?.lastPlayedSeconds) video.currentTime = episode.lastPlayedSeconds;
      video.play().catch(() => undefined);
    };

    const stop = () => onStopWatching(video.currentTime);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("pause", stop);
    window.addEventListener("pagehide", stop);

    return () => {
      stop();
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("pause", stop);
      window.removeEventListener("pagehide", stop);
      hls?.destroy();
    };
  }, [episode?.episodeKey, episode?.lastPlayedSeconds, onStopWatching, url, useNative]);

  if (!episode || !url) {
    return <div className="blank-state">No episode loaded.</div>;
  }

  if (useNative) {
    return <video ref={videoRef} controls autoPlay />;
  }

  return <iframe src={url} allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />;
}
```

Effect is correct here because HLS, media events, and `pagehide` are external systems.

- [ ] **Step 3: Implement detail client**

Write `src/components/playlist/playlist-detail-client.tsx` with local state for selected source, selected episode, editor drawer, episode view mode, and toast. On source switch, keep current episode index only if it exists in the new source; otherwise keep current source and show `Episode does not exist in that source`. Update URL with `router.push`.

Use this core source-switch handler:

```tsx
const switchSource = (nextSourceId: string) => {
  const nextSource = playlist.sources.find((source) => source.id === nextSourceId);
  if (!nextSource) return;

  if (!nextSource.episodes[currentEpisodeIndex]) {
    setToast("Episode does not exist in that source");
    window.setTimeout(() => setToast(null), 2500);
    return;
  }

  setCurrentSourceId(nextSource.id);
  router.push(`/playlist/${playlist.id}?source=${nextSource.id}&episode=${currentEpisodeIndex}`);
};
```

Use this keyboard handler inside the component:

```tsx
const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
  const target = event.target as HTMLElement;
  if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;

  if (event.ctrlKey && event.altKey && event.code === "KeyX") {
    event.preventDefault();
    selectEpisode(Math.min(currentEpisodeIndex + 1, currentSource.episodes.length - 1));
  }
};
```

Attach `onKeyDown` to the root `.fullscreen-wrapper` and set `tabIndex={-1}`.

- [ ] **Step 4: Add legacy-compatible CSS**

Append to `src/app/globals.css`:

```css
.blank-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--color-muted);
  font-size: 24px;
  text-align: center;
  z-index: 5;
}

.counter-overlay {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 10;
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 15px;
  font-weight: 700;
  backdrop-filter: blur(4px);
  pointer-events: none;
}

.action-hover-zone {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 10;
  width: 220px;
  height: 280px;
  padding: 50px;
}

.action-btn {
  position: absolute;
  right: 20px;
  z-index: 10;
  min-width: 45px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  backdrop-filter: blur(4px);
  opacity: 0;
  pointer-events: none;
}

.action-hover-zone:hover .action-btn {
  opacity: 1;
  pointer-events: auto;
}

.inline-toast {
  position: absolute;
  right: 24px;
  bottom: 24px;
  z-index: 80;
  max-width: min(420px, calc(100vw - 48px));
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-panel);
  color: var(--color-text);
  box-shadow: var(--shadow-panel);
}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`

Expected: PASS or errors only from missing editor/action modules planned in Task 8. Create empty exports only when needed to unblock TypeScript, then replace them in Task 8.

- [ ] **Step 6: Commit**

```bash
git add src/components/playlist src/app/globals.css
git commit -m "feat: add playback detail surface"
```

## Task 8: Playback Persistence Actions

**Files:**
- Create: `src/actions/playback.ts`
- Modify: `src/components/playlist/playlist-detail-client.tsx`
- Modify: `src/components/playlist/player-stage.tsx`

- [ ] **Step 1: Implement playback action**

Write `src/actions/playback.ts`:

```ts
"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { episodes, playlists, sources } from "@/db/schema";
import { logMutation } from "./playlists";

export async function savePlaybackProgress(input: {
  playlistId: string;
  sourceId: string;
  episodeKey: string;
  seconds: number;
}) {
  const seconds = Math.max(0, Math.floor(input.seconds));
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.update(episodes).set({
      lastPlayedSeconds: seconds,
      lastPlayedAt: now,
      updatedAt: now
    }).where(and(eq(episodes.sourceId, input.sourceId), eq(episodes.episodeKey, input.episodeKey)));

    await tx.update(sources).set({
      lastPlayedEpisodeKey: input.episodeKey,
      lastPlayedSeconds: seconds,
      lastPlayedAt: now,
      updatedAt: now
    }).where(eq(sources.id, input.sourceId));

    await tx.update(playlists).set({
      lastPlayedSourceId: input.sourceId,
      lastPlayedEpisodeKey: input.episodeKey,
      lastPlayedAt: now,
      updatedAt: now
    }).where(eq(playlists.id, input.playlistId));
  });

  await logMutation("playback.update", "Saved playback progress", input.playlistId);
}
```

- [ ] **Step 2: Wire stop-watching events**

In `playlist-detail-client.tsx`, pass `onStopWatching` to `PlayerStage`:

```tsx
const onStopWatching = (seconds: number) => {
  const episode = currentSource.episodes[currentEpisodeIndex];
  if (!episode || Math.floor(seconds) === Math.floor(episode.lastPlayedSeconds)) return;

  void savePlaybackProgress({
    playlistId: playlist.id,
    sourceId: currentSource.id,
    episodeKey: episode.episodeKey,
    seconds
  });
};
```

For minute interval saving while watching, use an interval inside `PlayerStage` because the media element is an external system:

```tsx
const interval = window.setInterval(() => {
  if (!video.paused) onStopWatching(video.currentTime);
}, 60000);
```

Clear the interval in the existing cleanup.

- [ ] **Step 3: Verify**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/actions/playback.ts src/components/playlist
git commit -m "feat: persist playback progress"
```

## Task 9: Editor Drawer and Source Mutations

**Files:**
- Modify: `src/actions/playlists.ts`
- Create: `src/actions/import.ts`
- Create: `src/components/playlist/editor-drawer.tsx`
- Modify: `src/components/playlist/playlist-detail-client.tsx`

- [ ] **Step 1: Add create/update actions with optimistic concurrency**

Append to `src/actions/playlists.ts`:

```ts
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { episodes, playlists, sources, thirtyDaysFromNow } from "@/db/schema";

export async function updatePlaylistTitle(input: {
  adminSecret: string;
  playlistId: string;
  title: string;
  version: number;
}): Promise<ActionResult> {
  const auth = assertAdminSecret(input.adminSecret);
  if (!auth.ok) return auth;

  const result = await db.update(playlists)
    .set({ title: input.title.trim() || "Untitled Playlist", version: input.version + 1, updatedAt: new Date() })
    .where(and(eq(playlists.id, input.playlistId), eq(playlists.version, input.version)))
    .returning({ id: playlists.id });

  if (result.length === 0) return { ok: false, error: "This playlist changed. Refresh before saving.", conflict: true };

  await logMutation("playlist.update", `Updated playlist title to ${input.title}`, input.playlistId);
  revalidatePath("/");
  revalidatePath(`/playlist/${input.playlistId}`);
  return { ok: true, data: undefined };
}

export async function createBlankSource(input: {
  adminSecret: string;
  playlistId: string;
  sourceTitle: string;
  sourceUrl: string;
}): Promise<ActionResult<{ sourceId: string }>> {
  const auth = assertAdminSecret(input.adminSecret);
  if (!auth.ok) return auth;

  const sourceKey = `${Date.now()}-${input.sourceTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "source"}`;
  const [{ id }] = await db.insert(sources).values({
    playlistId: input.playlistId,
    sourceKey,
    sourceTitle: input.sourceTitle.trim() || "New Source",
    sourceUrl: input.sourceUrl.trim(),
    sortOrder: sql<number>`(select coalesce(max(${sources.sortOrder}), -1) + 1 from ${sources} where ${sources.playlistId} = ${input.playlistId})`
  }).returning({ id: sources.id });

  await logMutation("source.create", `Created source ${input.sourceTitle}`, id);
  revalidatePath(`/playlist/${input.playlistId}`);
  return { ok: true, data: { sourceId: id } };
}

export async function softDeleteSource(input: {
  adminSecret: string;
  playlistId: string;
  sourceId: string;
}): Promise<ActionResult> {
  const auth = assertAdminSecret(input.adminSecret);
  if (!auth.ok) return auth;

  await db.update(sources).set({ deletedAt: new Date(), purgeAfter: thirtyDaysFromNow }).where(eq(sources.id, input.sourceId));
  await logMutation("source.delete", "Moved source to trash", input.sourceId);
  revalidatePath(`/playlist/${input.playlistId}`);
  revalidatePath("/trash");
  return { ok: true, data: undefined };
}
```

- [ ] **Step 2: Add editor drawer UI**

Write `src/components/playlist/editor-drawer.tsx` as a client component that:

- Reads `adminSecret` from `localStorage.getItem("adminSecret")` inside event handlers.
- Edits source title, URL, and preferred link type.
- Has `Create New Source`, `Refresh Source`, `Save`, and `Delete Source` buttons.
- Shows conflict response text exactly as returned by actions.
- Keeps raw JSON import/export in a collapsed `<details>` block labelled `Advanced JSON`.

Use direct event handlers for saves. Do not use `useEffect` for save/reset chains.

- [ ] **Step 3: Verify**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/actions/playlists.ts src/actions/import.ts src/components/playlist/editor-drawer.tsx src/components/playlist/playlist-detail-client.tsx
git commit -m "feat: add admin editor drawer"
```

## Task 10: Source Import Refresh, Soft Deletes, and Snapshots

**Files:**
- Create: `src/lib/source-refresh.ts`
- Create: `src/lib/source-refresh.test.ts`
- Modify: `src/actions/import.ts`

- [ ] **Step 1: Write refresh tests**

Write `src/lib/source-refresh.test.ts`:

```ts
import { reconcileEpisodes } from "./source-refresh";

const existing = [
  { episodeKey: "ep-1", sortOrder: 0, deletedAt: null },
  { episodeKey: "ep-2", sortOrder: 1, deletedAt: null }
];

it("preserves imported order and marks removed episodes deleted", () => {
  const result = reconcileEpisodes(existing, [
    { episodeKey: "ep-2", title: "2", slug: "ep-2", filename: null, embedUrl: "embed2", m3u8Url: "m3u82" },
    { episodeKey: "ep-3", title: "3", slug: "ep-3", filename: null, embedUrl: "embed3", m3u8Url: "m3u83" }
  ]);

  expect(result.upserts.map((episode) => [episode.episodeKey, episode.sortOrder])).toEqual([["ep-2", 0], ["ep-3", 1]]);
  expect(result.softDeletes).toEqual(["ep-1"]);
});
```

- [ ] **Step 2: Implement reconciliation**

Write `src/lib/source-refresh.ts`:

```ts
import { createHash } from "node:crypto";
import type { ImportedEpisode } from "./types";

type ExistingEpisode = {
  episodeKey: string;
  sortOrder: number;
  deletedAt: Date | null;
};

export function canonicalHash(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function reconcileEpisodes(existing: ExistingEpisode[], imported: ImportedEpisode[]) {
  const importedKeys = new Set(imported.map((episode) => episode.episodeKey));
  const softDeletes = existing
    .filter((episode) => !episode.deletedAt && !importedKeys.has(episode.episodeKey))
    .map((episode) => episode.episodeKey);

  const upserts = imported.map((episode, index) => ({
    episodeKey: episode.episodeKey,
    title: episode.title,
    slug: episode.slug,
    filename: episode.filename,
    embedUrl: episode.embedUrl,
    m3u8Url: episode.m3u8Url,
    sortOrder: index
  }));

  return { upserts, softDeletes };
}
```

- [ ] **Step 3: Implement import actions**

Write `src/actions/import.ts` with:

- `fetchSourceJson(url)` using server-side `fetch(url, { cache: "no-store" })`.
- `createPlaylistFromUrl(adminSecret, sourceUrl)` that normalizes imported movie, inserts playlist/source/episodes, stores derived banner image, writes one snapshot per source, logs `playlist.create`.
- `refreshSource(adminSecret, playlistId, sourceId, sourceUrl)` that normalizes import response, reconciles episodes, soft-deletes removed episodes, keeps source as failed draft with `importError` if fetch or parse fails, caps snapshots to 10 newest per source, and logs `source.refresh`.

Use `canonicalHash(importedSource)` before writing snapshots. If the hash already exists, do not insert a duplicate snapshot.

- [ ] **Step 4: Verify**

Run: `npm run test -- src/lib/source-refresh.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/source-refresh.ts src/lib/source-refresh.test.ts src/actions/import.ts
git commit -m "feat: refresh imported sources"
```

## Task 11: Trash, Restore, Purge, and Change Log

**Files:**
- Create: `src/db/queries/trash.ts`
- Create: `src/app/trash/page.tsx`
- Create: `src/components/trash/trash-client.tsx`
- Modify: `src/actions/playlists.ts`

- [ ] **Step 1: Add trash query**

Write `src/db/queries/trash.ts`:

```ts
import { asc, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { episodes, playlists, sources } from "@/db/schema";

export async function getTrash() {
  const [deletedPlaylists, deletedSources, deletedEpisodes, logs] = await Promise.all([
    db.select().from(playlists).where(isNotNull(playlists.deletedAt)).orderBy(asc(playlists.purgeAfter)),
    db.select().from(sources).where(isNotNull(sources.deletedAt)).orderBy(asc(sources.purgeAfter)),
    db.select().from(episodes).where(isNotNull(episodes.deletedAt)).orderBy(asc(episodes.purgeAfter)),
    db.query.mutationLogs.findMany({ orderBy: (table, { desc }) => [desc(table.createdAt)], limit: 50 })
  ]);

  return { deletedPlaylists, deletedSources, deletedEpisodes, logs };
}
```

- [ ] **Step 2: Add restore and purge actions**

Append to `src/actions/playlists.ts` actions:

- `restorePlaylist(adminSecret, playlistId)` sets `deletedAt` and `purgeAfter` to `null`.
- `restoreSource(adminSecret, sourceId)` sets `deletedAt` and `purgeAfter` to `null`.
- `restoreEpisode(adminSecret, episodeId)` sets `deletedAt` and `purgeAfter` to `null`.
- `purgeExpiredTrash(adminSecret)` deletes episodes, sources, and playlists where `purgeAfter < now()`, logs `trash.purge`.

Every action must call `assertAdminSecret`, log a mutation, and `revalidatePath("/trash")`.

- [ ] **Step 3: Add trash page**

Write `src/app/trash/page.tsx`:

```tsx
import { getTrash } from "@/db/queries/trash";
import { TrashClient } from "@/components/trash/trash-client";

export default async function TrashPage() {
  const trash = await getTrash();
  return <TrashClient trash={trash} />;
}
```

- [ ] **Step 4: Add trash client**

Write `src/components/trash/trash-client.tsx` as a client component with three sections: playlists, sources, episodes. Each row shows title/source/episode key, deleted date, purge date, Restore button, and disabled Purge label until automatic purge is run. Read admin secret from `localStorage` only inside button handlers.

- [ ] **Step 5: Verify**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/db/queries/trash.ts src/app/trash src/components/trash src/actions/playlists.ts
git commit -m "feat: add trash and mutation log"
```

## Task 12: LocalStorage Migration Escape Hatch

**Files:**
- Create: `src/components/admin/local-storage-importer.tsx`
- Modify: `src/components/home/playlist-home-client.tsx`
- Modify: `src/actions/import.ts`

- [ ] **Step 1: Add importer UI**

Create `src/components/admin/local-storage-importer.tsx` that reads `localStorage.getItem("playlists")`, displays the count, and submits parsed legacy items to a server action. This is event-driven; do not use `useEffect`.

Legacy shape to support:

```ts
type LegacyPlaylist = {
  id: string;
  name: string;
  rawText: string;
  currentIndex?: number;
  autoSkipEnabled?: boolean;
  autoSkipTime?: string;
  m3u8LastEp?: number | null;
  m3u8LastTime?: number | null;
  playedIndices?: number[];
  jsonUrl?: string;
  selectedServer?: number;
  preferEmbed?: boolean;
};
```

- [ ] **Step 2: Add import action**

In `src/actions/import.ts`, implement `importLegacyPlaylists(adminSecret, rows)`:

- Convert each legacy playlist to one playlist row.
- Create one source named `Legacy Source` when `jsonUrl` is empty.
- Parse `rawText` by splitting each non-empty line on first `|`.
- Use episode key `legacy:${episodeNumber}`.
- Store `currentIndex`, `m3u8LastEp`, and `m3u8LastTime` as source/episode playback state.
- Keep imported order.
- Log `playlist.create` for each playlist.

- [ ] **Step 3: Add importer to admin modal**

Show `LocalStorageImporter` only after unlock succeeds.

- [ ] **Step 4: Verify with a fixture**

Add a unit test in `src/lib/importers.test.ts` for raw text parsing:

```ts
import { parseLegacyRawText } from "./importers";

it("parses legacy Episode|URL lines", () => {
  expect(parseLegacyRawText("1|https://a.test\n2|https://b.test")).toEqual([
    { episodeKey: "legacy:1", title: "1", slug: null, filename: null, embedUrl: "https://a.test", m3u8Url: null },
    { episodeKey: "legacy:2", title: "2", slug: null, filename: null, embedUrl: "https://b.test", m3u8Url: null }
  ]);
});
```

Implement `parseLegacyRawText` in `src/lib/importers.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin src/actions/import.ts src/lib/importers.ts src/lib/importers.test.ts
git commit -m "feat: import legacy local playlists"
```

## Task 13: End-to-End Smoke Tests and Deployment Prep

**Files:**
- Create: `tests/e2e/playback.spec.ts`
- Modify: `README.md`
- Modify: `.env.example`

- [ ] **Step 1: Add e2e smoke tests**

Write `tests/e2e/playback.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("home page renders playlist search", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByPlaceholder("Search playlists")).toBeVisible();
});

test("admin unlock modal opens", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
```

- [ ] **Step 2: Add README**

Write `README.md`:

```md
# Immersive Video Playlist

Next.js App Router migration of the legacy static immersive video playlist app.

## Setup

1. Copy `.env.example` to `.env.local`.
2. Set `DATABASE_URL` to the Neon Postgres connection string.
3. Set `ADMIN_SECRET` to the shared write secret.
4. Run `npm install`.
5. Run `npm run db:migrate`.
6. Run `npm run dev`.

## Checks

- Unit tests: `npm run test`
- Build: `npm run build`
- E2E smoke: `npm run test:e2e`

## Legacy Reference

`index.html` stays in the repository until playback behavior, editor behavior, shortcuts, and source import parity are verified.
```

- [ ] **Step 3: Verify all checks**

Run: `npm run test`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

Run: `npm run test:e2e`

Expected: PASS for Chromium and mobile projects.

- [ ] **Step 4: Commit**

```bash
git add tests README.md .env.example
git commit -m "test: add migration smoke coverage"
```

## Deployment Notes

- On Vercel, set `DATABASE_URL` and `ADMIN_SECRET`.
- Run `npm run db:migrate` against Neon before first production deploy.
- Keep public viewing unauthenticated.
- Keep writes server-action only and protected by `ADMIN_SECRET`.
- Do not expose `ADMIN_SECRET` through `NEXT_PUBLIC_*`.

## Self-Review

- Spec coverage:
  - Next.js App Router, TypeScript, Vercel, Neon, Drizzle: Tasks 1 and 3.
  - Server actions and shared-secret admin gate: Tasks 4, 8, 9, 10, 11, 12.
  - Public home grid, last-played sorting, pinned order, banners, search: Task 5.
  - `/playlist/[id]`, URL source/episode params, playback-first detail route: Tasks 6 and 7.
  - Multi-source model, source order, source edit, create source, source playback state: Tasks 3, 6, 9.
  - Episode keys, refresh matching, soft delete, trash: Tasks 2, 10, 11.
  - Playback resume and stop-watching writes: Tasks 6, 7, 8.
  - Legacy full-width/full-height detail UI and shortcuts: Task 7.
  - Admin change log: Tasks 4 and 11.
  - LocalStorage migration: Task 12.
  - Deployment prep: Task 13.
- Placeholder scan:
  - No banned placeholder markers from the skill's failure list.
  - Remaining component tasks specify exact behavior and required file paths.
- Type consistency:
  - `preferredLinkType` is consistently `"m3u8" | "embed"`.
  - `episodeKey`, `sourceKey`, `lastPlayedSourceId`, and `lastPlayedEpisodeKey` names match across schema, actions, and utilities.
  - Admin action results consistently use `ActionResult`.
