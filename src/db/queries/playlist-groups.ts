import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import { playlistGroupMembers } from "@/db/schema";

export async function getPlaylistGroups() {
  return db.query.playlistGroups.findMany({
    with: {
      members: {
        columns: { playlistId: true },
        orderBy: [asc(playlistGroupMembers.sortOrder)],
      },
    },
  });
}

export type PlaylistGroup = Awaited<ReturnType<typeof getPlaylistGroups>>[number];
