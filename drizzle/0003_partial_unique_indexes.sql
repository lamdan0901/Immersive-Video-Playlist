DROP INDEX IF EXISTS "sources_playlist_source_key_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "sources_playlist_source_key_unique" ON "sources" ("playlist_id", "source_key") WHERE "deleted_at" IS NULL;--> statement-breakpoint

DROP INDEX IF EXISTS "episodes_source_episode_key_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "episodes_source_episode_key_unique" ON "episodes" ("source_id", "episode_key") WHERE "deleted_at" IS NULL;
