type PlaybackSource = {
  id: string;
  lastPlayedEpisodeKey: string | null;
  episodes: { episodeKey: string }[];
};

function parseNonNegativeInteger(value: unknown) {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.floor(numeric));
}

export function resolveInitialPlayback(
  sources: PlaybackSource[],
  query: { sourceId: string | null; episodeIndex: string | null }
) {
  const source = sources.find((item) => item.id === query.sourceId) ?? sources[0];
  if (!source) return { sourceId: null, episodeIndex: 0 };

  const parsed = query.episodeIndex == null ? Number.NaN : Number.parseInt(query.episodeIndex, 10);
  if (Number.isInteger(parsed) && parsed >= 0 && parsed < source.episodes.length) {
    return { sourceId: source.id, episodeIndex: parsed };
  }

  const lastIndex = source.episodes.findIndex((episode) => episode.episodeKey === source.lastPlayedEpisodeKey);
  return { sourceId: source.id, episodeIndex: lastIndex >= 0 ? lastIndex : 0 };
}

export function shouldSavePlayback(nextSeconds: number, previousSeconds: number) {
  return Math.floor(nextSeconds) !== Math.floor(previousSeconds);
}

export function resolveSkipStartSeconds(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || !("skipStartSeconds" in metadata)) {
    return 0;
  }

  return parseNonNegativeInteger(metadata.skipStartSeconds);
}
