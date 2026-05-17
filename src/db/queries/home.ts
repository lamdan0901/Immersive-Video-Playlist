import { asc, desc, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { episodes, playlists, sources } from "@/db/schema";
import { chooseBanner } from "@/lib/banner";
import type { SearchablePlaylist } from "@/lib/relevance";
import { extractArtworkUrls, extractMetadataText } from "./home-metadata";

export type PlaylistSummary = SearchablePlaylist & {
  banner: ReturnType<typeof chooseBanner>;
  updatedAt: string;
  version: number;
  autoRefreshDisabled: boolean;
  activeSourceTitle: string | null;
  activeSourceLastPlayedEpisodeIndex: number;
  activeSourceTotalEpisodes: number;
  allSources: { title: string; totalEpisodes: number }[];
};

async function fetchPlaylistSummaries(): Promise<PlaylistSummary[]> {
  const playlistRows = await db.query.playlists.findMany({
    where: isNull(playlists.deletedAt),
    orderBy: [desc(playlists.lastPlayedAt), desc(playlists.pinned), asc(playlists.pinnedOrder)],
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

  return playlistRows.map((playlist) => {
    const sourceTitles = playlist.sources.map((source) => source.sourceTitle);
    const artworkUrls = extractArtworkUrls(playlist.metadata);
    const activeSource = playlist.sources.find((s) => s.id === playlist.lastPlayedSourceId) ?? playlist.sources[0] ?? null;
    const activeSourceTotalEpisodes = activeSource?.episodes.length ?? 0;
    const activeSourceLastPlayedEpisodeIndex = activeSource
      ? activeSource.episodes.findIndex((ep) => ep.episodeKey === activeSource.lastPlayedEpisodeKey)
      : -1;

    const allSources = playlist.sources.map((source) => ({
      title: source.sourceTitle,
      totalEpisodes: source.episodes.length,
    }));

    return {
      id: playlist.id,
      title: playlist.title,
      sourceTitles,
      metadataText: extractMetadataText(playlist.metadata),
      pinned: playlist.pinned,
      pinnedOrder: playlist.pinnedOrder,
      version: playlist.version,
      autoRefreshDisabled: playlist.autoRefreshDisabled,
      lastPlayedAt: playlist.lastPlayedAt?.toISOString() ?? null,
      updatedAt: playlist.updatedAt.toISOString(),
      activeSourceTitle: activeSource?.sourceTitle ?? null,
      activeSourceLastPlayedEpisodeIndex: activeSourceLastPlayedEpisodeIndex >= 0 ? activeSourceLastPlayedEpisodeIndex : 0,
      activeSourceTotalEpisodes,
      allSources,
      banner: chooseBanner({
        title: playlist.title,
        bannerOverrideUrl: playlist.bannerOverrideUrl,
        derivedImageUrl: playlist.derivedImageUrl,
        sourceImages: artworkUrls
      })
    };
  });
}

export const getPlaylistSummaries = fetchPlaylistSummaries;
