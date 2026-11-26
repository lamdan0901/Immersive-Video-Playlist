CREATE TABLE "playlist_group_members" (
	"playlist_id" uuid PRIMARY KEY NOT NULL,
	"group_id" uuid NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playlist_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"note" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "playlist_group_members" ADD CONSTRAINT "playlist_group_members_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_group_members" ADD CONSTRAINT "playlist_group_members_group_id_playlist_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."playlist_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "playlist_group_members_order_idx" ON "playlist_group_members" USING btree ("group_id","sort_order");