import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { normalizeImportedMovie } from "@/lib/importers";
import { pickDerivedImage } from "@/lib/playlist-artwork";
import { mockPlaylists } from "./mock-playlist-fixtures";
import * as schema from "./schema";

const seedMarker = "Seeded local mock playlists";

export async function openMockPlaylistDb(dataDir = resolve(".mock-playlists")) {
  const client = await PGlite.create(dataDir);
  const db = drizzle({ client, schema });

  try {
    await migrate(db, { migrationsFolder: resolve("drizzle") });
    await db.transaction(async (tx) => {
      const seeded = await tx.query.mutationLogs.findFirst({
        where: eq(schema.mutationLogs.summary, seedMarker),
        columns: { id: true },
      });
      if (seeded) return;

      for (const [slug, payload] of mockPlaylists) {
        const movie = normalizeImportedMovie(payload, `/api/mock-playlists/${slug}`);
        const [{ id: playlistId }] = await tx.insert(schema.playlists).values({
          title: movie.title,
          slug: movie.slug,
          derivedImageUrl: pickDerivedImage(movie),
          pinned: slug === "open-shorts",
          metadata: movie.metadata,
        }).returning({ id: schema.playlists.id });

        for (const [sortOrder, source] of movie.sources.entries()) {
          const [{ id: sourceId }] = await tx.insert(schema.sources).values({
            playlistId,
            sourceKey: source.sourceKey,
            sourceTitle: source.sourceTitle,
            sourceUrl: source.sourceUrl,
            preferredLinkType: source.preferredLinkType,
            sortOrder,
          }).returning({ id: schema.sources.id });

          await tx.insert(schema.episodes).values(source.episodes.map((episode, sortOrder) => ({
            ...episode,
            sourceId,
            sortOrder,
          })));
        }
      }

      await tx.insert(schema.mutationLogs).values({
        kind: "playlist.create",
        summary: seedMarker,
      });
    });
  } catch (error) {
    await client.close();
    throw error;
  }

  return db;
}
