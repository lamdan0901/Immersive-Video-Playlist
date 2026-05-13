"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { db } from "@/db/client";
import { episodes, playlists, sources } from "@/db/schema";
import { logMutation } from "./playlists";

function assertRelationExists(rows: Array<{ id: string }>, message: string) {
  if (rows.length === 0) {
    throw new Error(message);
  }
}

export async function savePlaybackProgress(input: {
  playlistId: string;
  sourceId: string;
  episodeKey: string;
  seconds: number;
}) {
  const seconds = Number.isFinite(input.seconds)
    ? Math.max(0, Math.floor(input.seconds))
    : 0;
  const now = new Date();
  const monotonicSeconds = <TColumn>(column: TColumn) =>
    sql<number>`greatest(${column}, ${seconds})`;

  await db.transaction(async (tx) => {
    const playlistRows = await tx
      .update(playlists)
      .set({
        lastPlayedSourceId: input.sourceId,
        lastPlayedEpisodeKey: input.episodeKey,
        lastPlayedAt: now,
        updatedAt: now,
      })
      .where(eq(playlists.id, input.playlistId))
      .returning({ id: playlists.id });
    assertRelationExists(playlistRows, "Playlist not found");

    const sourceRows = await tx
      .update(sources)
      .set({
        lastPlayedEpisodeKey: input.episodeKey,
        lastPlayedSeconds: monotonicSeconds(sources.lastPlayedSeconds),
        lastPlayedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(sources.id, input.sourceId),
          eq(sources.playlistId, input.playlistId),
        ),
      )
      .returning({ id: sources.id });
    assertRelationExists(sourceRows, "Source does not belong to playlist");

    const episodeRows = await tx
      .update(episodes)
      .set({
        lastPlayedSeconds: monotonicSeconds(episodes.lastPlayedSeconds),
        lastPlayedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(episodes.sourceId, input.sourceId),
          eq(episodes.episodeKey, input.episodeKey),
        ),
      )
      .returning({ id: episodes.id });
    assertRelationExists(episodeRows, "Episode does not belong to source");
  });

  await logMutation(
    "playback.update",
    "Saved playback progress",
    input.playlistId,
  );
  revalidateTag("playlists");
}
