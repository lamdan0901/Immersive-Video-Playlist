import { createHash } from "node:crypto";
import type { ImportedEpisode } from "./types";

type ExistingEpisode = {
  episodeKey: string;
  sortOrder: number;
  deletedAt: Date | null;
};

export function canonicalHash(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
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
