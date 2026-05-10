ALTER TABLE "sources" ADD COLUMN IF NOT EXISTS "last_refreshed_at" timestamp with time zone;
