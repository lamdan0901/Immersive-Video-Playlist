DROP INDEX "episodes_source_episode_key_unique";--> statement-breakpoint
DROP INDEX "sources_playlist_source_key_unique";--> statement-breakpoint
ALTER TABLE "playlists" ADD COLUMN "volume" double precision DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "episodes_source_episode_key_unique" ON "episodes" USING btree ("source_id","episode_key") WHERE "episodes"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "sources_playlist_source_key_unique" ON "sources" USING btree ("playlist_id","source_key") WHERE "sources"."deleted_at" IS NULL;