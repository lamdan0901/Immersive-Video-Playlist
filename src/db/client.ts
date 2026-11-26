import "server-only";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

type PlaylistDb = PgDatabase<PgQueryResultHKT, typeof schema>;

const local = globalThis as typeof globalThis & {
  mockPlaylistDb?: Promise<PlaylistDb>;
};
let neonDb: PlaylistDb | undefined;

export function isMockPlaylistMode() {
  return process.env.NODE_ENV === "development" && process.env.MOCK_PLAYLISTS === "true";
}

export async function getDb(): Promise<PlaylistDb> {
  if (isMockPlaylistMode()) {
    local.mockPlaylistDb ??= import("./mock-client")
      .then(({ openMockPlaylistDb }) => openMockPlaylistDb())
      .catch((error) => {
        delete local.mockPlaylistDb;
        throw error;
      });
    return local.mockPlaylistDb;
  }

  if (!neonDb) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required");
    }
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    neonDb = drizzle({ client: pool, schema });
  }
  return neonDb;
}
