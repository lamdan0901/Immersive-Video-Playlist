type PlaybackSource = {
  id: string;
  lastPlayedEpisodeKey: string | null;
  episodes: { episodeKey: string }[];
};

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
