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
