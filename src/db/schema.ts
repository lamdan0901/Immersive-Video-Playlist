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
  "playlist.restore",
  "source.create",
  "source.update",
  "source.refresh",
  "source.delete",
  "source.restore",
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
  playlistId: uuid("playlist_id").notNull().references(() => playlists.id, { onDelete: "cascade" }),
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
  sourceId: uuid("source_id").notNull().references(() => sources.id, { onDelete: "cascade" }),
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
  version: integer("version").notNull().default(1),
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
  sourceId: uuid("source_id").notNull().references(() => sources.id, { onDelete: "cascade" }),
  canonicalHash: text("canonical_hash").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  sourceCreatedAtIdx: index("source_snapshots_source_created_at_idx").on(table.sourceId, table.createdAt),
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
