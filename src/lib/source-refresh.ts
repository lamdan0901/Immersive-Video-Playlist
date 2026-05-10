import { createHash } from "node:crypto";
import type { ImportedEpisode, ImportedSource } from "./types";

type ExistingEpisode = {
  episodeKey: string;
  sortOrder: number;
  deletedAt: Date | null;
};

type ExistingSourceIdentity = {
  sourceKey: string;
  sourceTitle: string;
  sortOrder: number;
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, stableValue(nestedValue)])
    );
  }

  return value;
}

export function canonicalHash(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(stableValue(payload))).digest("hex");
}

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
