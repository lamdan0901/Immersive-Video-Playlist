import { asc, desc, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { playlists, sources } from "@/db/schema";
import { chooseBanner } from "@/lib/banner";
import type { SearchablePlaylist } from "@/lib/relevance";
import { extractArtworkUrls, extractMetadataText } from "./home-metadata";

export type PlaylistSummary = SearchablePlaylist & {
  banner: ReturnType<typeof chooseBanner>;
  updatedAt: string;
  version: number;
};

export async function getPlaylistSummaries(): Promise<PlaylistSummary[]> {
  const playlistRows = await db.query.playlists.findMany({
    where: isNull(playlists.deletedAt),
    orderBy: [desc(playlists.lastPlayedAt), desc(playlists.pinned), asc(playlists.pinnedOrder)],
    with: {
      sources: {
        where: isNull(sources.deletedAt),
        orderBy: [asc(sources.sortOrder)]
      }
    }
  });

  return playlistRows.map((playlist) => {
    const sourceTitles = playlist.sources.map((source) => source.sourceTitle);
    const artworkUrls = extractArtworkUrls(playlist.metadata);

    return {
      id: playlist.id,
      title: playlist.title,
      sourceTitles,
      metadataText: extractMetadataText(playlist.metadata),
      pinned: playlist.pinned,
      pinnedOrder: playlist.pinnedOrder,
      version: playlist.version,
      lastPlayedAt: playlist.lastPlayedAt?.toISOString() ?? null,
      updatedAt: playlist.updatedAt.toISOString(),
      banner: chooseBanner({
        title: playlist.title,
        bannerOverrideUrl: playlist.bannerOverrideUrl,
        derivedImageUrl: playlist.derivedImageUrl,
        sourceImages: artworkUrls
      })
    };
  });
}
