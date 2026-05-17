ALTER TABLE "playlists" ADD COLUMN "auto_refresh_disabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "last_refreshed_at" timestamp with time zone;