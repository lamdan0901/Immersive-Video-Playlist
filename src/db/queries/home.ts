import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
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
  refreshSources: { id: string; sourceUrl: string }[];
};

async function fetchPlaylistSummaries(): Promise<PlaylistSummary[]> {
  const playlistRows = await db.query.playlists.findMany({
    where: isNull(playlists.deletedAt),
    orderBy: [
      desc(playlists.lastPlayedAt),
      desc(playlists.pinned),
      asc(playlists.pinnedOrder),
    ],
    columns: {
      id: true,
      title: true,
      bannerOverrideUrl: true,
      derivedImageUrl: true,
      pinned: true,
      pinnedOrder: true,
      lastPlayedAt: true,
      lastPlayedSourceId: true,
      lastPlayedEpisodeKey: true,
      metadata: true,
      version: true,
      autoRefreshDisabled: true,
      updatedAt: true,
    },
    with: {
      sources: {
        where: isNull(sources.deletedAt),
        orderBy: [asc(sources.sortOrder)],
        columns: {
          id: true,
          sourceTitle: true,
          lastPlayedEpisodeKey: true,
          sourceUrl: true,
        },
      },
    },
  });

  if (playlistRows.length === 0) return [];

  const allSourceIds = playlistRows.flatMap((p) => p.sources.map((s) => s.id));

  const [countRows, indexRows] = await Promise.all([
    db
      .select({
        sourceId: episodes.sourceId,
        count: sql<number>`count(*)::int`,
      })
      .from(episodes)
      .where(
        and(
          isNull(episodes.deletedAt),
          sql`${episodes.sourceId} = ANY(${sql.param(allSourceIds)})`,
        ),
      )
      .groupBy(episodes.sourceId),
    db
      .select({
        sourceId: episodes.sourceId,
        episodeKey: episodes.episodeKey,
        sortOrder: episodes.sortOrder,
      })
      .from(episodes)
      .where(
        and(
          isNull(episodes.deletedAt),
          sql`(${episodes.sourceId}, ${episodes.episodeKey}) in (${sql.join(
            playlistRows
              .map((p) => {
                const active =
                  p.sources.find((s) => s.id === p.lastPlayedSourceId) ??
                  p.sources[0];
                return active?.lastPlayedEpisodeKey
                  ? sql`(${sql.param(active.id)}, ${sql.param(active.lastPlayedEpisodeKey)})`
                  : null;
              })
              .filter((x): x is NonNullable<typeof x> => x !== null),
            sql`, `,
          )})`,
        ),
      ),
  ]);

  const countMap = new Map(countRows.map((r) => [r.sourceId, r.count]));
  const indexMap = new Map(indexRows.map((r) => [r.sourceId, r.sortOrder]));

  return playlistRows.map((playlist) => {
    const sourceTitles = playlist.sources.map((source) => source.sourceTitle);
    const artworkUrls = extractArtworkUrls(playlist.metadata);
    const activeSource =
      playlist.sources.find((s) => s.id === playlist.lastPlayedSourceId) ??
      playlist.sources[0] ??
      null;
    const activeSourceTotalEpisodes = activeSource
      ? (countMap.get(activeSource.id) ?? 0)
      : 0;
    const activeSourceLastPlayedEpisodeIndex = activeSource
      ? (indexMap.get(activeSource.id) ?? -1)
      : -1;

    const allSources = playlist.sources.map((source) => ({
      title: source.sourceTitle,
      totalEpisodes: countMap.get(source.id) ?? 0,
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
      activeSourceLastPlayedEpisodeIndex:
        activeSourceLastPlayedEpisodeIndex >= 0
          ? activeSourceLastPlayedEpisodeIndex
          : 0,
      activeSourceTotalEpisodes,
      allSources,
      refreshSources: playlist.sources.map((source) => ({
        id: source.id,
        sourceUrl: source.sourceUrl,
      })),
      banner: chooseBanner({
        title: playlist.title,
        bannerOverrideUrl: playlist.bannerOverrideUrl,
        derivedImageUrl: playlist.derivedImageUrl,
        sourceImages: artworkUrls,
      }),
    };
  });
}

export const getPlaylistSummaries = fetchPlaylistSummaries;
