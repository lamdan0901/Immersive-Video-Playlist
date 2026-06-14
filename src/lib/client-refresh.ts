import { fetchImportPayloadInBrowser, normalizeImportedMovie } from "./importers";
import {
  matchImportedSource,
  preserveEpisodeIdentity,
  reconcileEpisodes,
} from "./source-identity";
import type { LinkType } from "./types";

export type ClientRefreshEpisode = {
  episodeKey: string;
  title: string;
  embedUrl: string | null;
  m3u8Url: string | null;
};

export type ClientRefreshResult = {
  episodes: ClientRefreshEpisode[];
  sourceTitle: string;
  sourceUrl: string;
  preferredLinkType: LinkType;
};

type RefreshSourceInput = {
  sourceKey: string;
  sourceTitle: string;
  sortOrder: number;
  sourceUrl: string;
};

type RefreshEpisodeInput = {
  episodeKey: string;
  title?: string;
  slug?: string | null;
  filename?: string | null;
  sortOrder: number;
};

export async function performClientRefresh(
  source: RefreshSourceInput,
  existingEpisodes: RefreshEpisodeInput[],
): Promise<ClientRefreshResult> {
  const { sourceUrl, importedJson } = await fetchImportPayloadInBrowser(source.sourceUrl);
  const importedMovie = normalizeImportedMovie(importedJson, sourceUrl);
  const importedSource = matchImportedSource(source, importedMovie.sources);

  const existingWithDeletedAt = existingEpisodes.map((ep) => ({
    ...ep,
    deletedAt: null as unknown as Date,
  }));

  const normalizedEpisodes = preserveEpisodeIdentity(
    existingWithDeletedAt,
    importedSource.episodes,
  );

  const result = reconcileEpisodes(existingWithDeletedAt, normalizedEpisodes);

  return {
    episodes: result.upserts.map((ep) => ({
      episodeKey: ep.episodeKey,
      title: ep.title,
      embedUrl: ep.embedUrl,
      m3u8Url: ep.m3u8Url,
    })),
    sourceTitle: importedSource.sourceTitle,
    sourceUrl: importedSource.sourceUrl,
    preferredLinkType: importedSource.preferredLinkType,
  };
}
