import type { ImportedEpisode, ImportedSource } from "./types";

export type ExistingEpisode = {
  episodeKey: string;
  title?: string;
  slug?: string | null;
  filename?: string | null;
  sortOrder: number;
  deletedAt: Date | null;
};

export type ExistingSourceIdentity = {
  sourceKey: string;
  sourceTitle: string;
  sortOrder: number;
};

export function matchImportedSource(existing: ExistingSourceIdentity, imported: ImportedSource[]) {
  const keyMatch = imported.find((source) => source.sourceKey === existing.sourceKey);
  if (keyMatch) {
    return keyMatch;
  }

  const sortOrderMatch = imported[existing.sortOrder];
  if (sortOrderMatch) {
    return sortOrderMatch;
  }

  const titleMatch = imported.find((source) => source.sourceTitle === existing.sourceTitle);
  if (titleMatch) {
    return titleMatch;
  }

  if (imported.length === 1) {
    return imported[0];
  }

  throw new Error(`Imported payload does not contain source ${existing.sourceKey}`);
}

function indexUnique<TValue>(existing: ExistingEpisode[], pickValue: (episode: ExistingEpisode) => TValue) {
  const entries = new Map<TValue, ExistingEpisode | null>();

  for (const episode of existing) {
    const value = pickValue(episode);
    if (value == null) {
      continue;
    }

    const current = entries.get(value);
    if (current) {
      entries.set(value, null);
      continue;
    }

    if (current === null) {
      continue;
    }

    entries.set(value, episode);
  }

  return entries;
}

export function preserveEpisodeIdentity(existing: ExistingEpisode[], imported: ImportedEpisode[]) {
  const byKey = new Map(existing.map((episode) => [episode.episodeKey, episode]));
  const bySlug = indexUnique(existing, (episode) => episode.slug ?? null);
  const byFilename = indexUnique(existing, (episode) => episode.filename ?? null);
  const usedKeys = new Set<string>();

  return imported.map((episode, sortOrder) => {
    const exactMatch = byKey.get(episode.episodeKey);
    if (exactMatch) {
      usedKeys.add(exactMatch.episodeKey);
      return episode;
    }

    const slugMatch = episode.slug ? bySlug.get(episode.slug) : undefined;
    if (slugMatch && !usedKeys.has(slugMatch.episodeKey)) {
      usedKeys.add(slugMatch.episodeKey);
      return { ...episode, episodeKey: slugMatch.episodeKey };
    }

    const filenameMatch = episode.filename ? byFilename.get(episode.filename) : undefined;
    if (filenameMatch && !usedKeys.has(filenameMatch.episodeKey)) {
      usedKeys.add(filenameMatch.episodeKey);
      return { ...episode, episodeKey: filenameMatch.episodeKey };
    }

    const positionalMatch = existing.find((candidate) =>
      !usedKeys.has(candidate.episodeKey)
      && candidate.sortOrder === sortOrder
      && candidate.title === episode.title
      && candidate.slug == null
      && candidate.filename == null
      && episode.slug == null
      && episode.filename == null
    );

    if (positionalMatch) {
      usedKeys.add(positionalMatch.episodeKey);
      return { ...episode, episodeKey: positionalMatch.episodeKey };
    }

    return episode;
  });
}

export function reconcileEpisodes(existing: ExistingEpisode[], imported: ImportedEpisode[]) {
  const importedKeys = new Set(imported.map((episode) => episode.episodeKey));
  const softDeletes = existing
    .filter((episode) => !episode.deletedAt && !importedKeys.has(episode.episodeKey))
    .map((episode) => episode.episodeKey);

  const upserts = imported.map((episode, index) => ({
    episodeKey: episode.episodeKey,
    title: episode.title,
    slug: episode.slug,
    filename: episode.filename,
    embedUrl: episode.embedUrl,
    m3u8Url: episode.m3u8Url,
    sortOrder: index
  }));

  return { upserts, softDeletes };
}
