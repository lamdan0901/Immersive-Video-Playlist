CREATE TYPE "public"."link_type" AS ENUM('m3u8', 'embed');--> statement-breakpoint
CREATE TYPE "public"."mutation_kind" AS ENUM('playlist.create', 'playlist.update', 'playlist.delete', 'playlist.restore', 'source.create', 'source.update', 'source.refresh', 'source.delete', 'source.restore', 'episode.restore', 'trash.purge', 'playback.update');--> statement-breakpoint
CREATE TYPE "public"."trash_kind" AS ENUM('playlist', 'source', 'episode');--> statement-breakpoint
CREATE TABLE "episodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"episode_key" text NOT NULL,
	"title" text NOT NULL,
	"slug" text,
	"filename" text,
	"embed_url" text,
	"m3u8_url" text,
	"sort_order" integer NOT NULL,
	"last_played_seconds" integer DEFAULT 0 NOT NULL,
	"last_played_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"purge_after" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mutation_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "mutation_kind" NOT NULL,
	"entity_id" uuid,
	"summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"title" text NOT NULL,
	"slug" text,
	"banner_override_url" text,
	"derived_image_url" text,
	"pinned" boolean DEFAULT false NOT NULL,
	"pinned_order" integer DEFAULT 0 NOT NULL,
	"last_played_at" timestamp with time zone,
	"last_played_source_id" uuid,
	"last_played_episode_key" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"purge_after" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"canonical_hash" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"playlist_id" uuid NOT NULL,
	"source_key" text NOT NULL,
	"source_title" text NOT NULL,
	"source_url" text NOT NULL,
	"preferred_link_type" "link_type" DEFAULT 'm3u8' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"last_played_episode_key" text,
	"last_played_seconds" integer DEFAULT 0 NOT NULL,
	"last_played_at" timestamp with time zone,
	"import_error" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"purge_after" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_snapshots" ADD CONSTRAINT "source_snapshots_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "episodes_source_episode_key_unique" ON "episodes" USING btree ("source_id","episode_key");--> statement-breakpoint
CREATE INDEX "episodes_source_order_idx" ON "episodes" USING btree ("source_id","sort_order");--> statement-breakpoint
CREATE INDEX "playlists_active_idx" ON "playlists" USING btree ("deleted_at","last_played_at");--> statement-breakpoint
CREATE INDEX "playlists_pinned_idx" ON "playlists" USING btree ("pinned","pinned_order");--> statement-breakpoint
CREATE INDEX "source_snapshots_source_created_at_idx" ON "source_snapshots" USING btree ("source_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "source_snapshots_source_hash_unique" ON "source_snapshots" USING btree ("source_id","canonical_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_playlist_source_key_unique" ON "sources" USING btree ("playlist_id","source_key");--> statement-breakpoint
CREATE INDEX "sources_playlist_order_idx" ON "sources" USING btree ("playlist_id","sort_order");