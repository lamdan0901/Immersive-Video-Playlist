"use client";

type Episode = {
  episodeKey: string;
  title: string;
  lastPlayedSeconds: number;
};

export function EpisodeList({
  episodes,
  currentEpisodeIndex,
  onSelect
}: {
  episodes: Episode[];
  currentEpisodeIndex: number;
  onSelect: (index: number) => void;
}) {
  const isCompactGrid = episodes.length > 20;

  return (
    <section className="playlist-detail-panel playlist-detail-episode-panel" aria-label="Episode list">
      <div className="playlist-detail-panel-header">
        <span>Episodes</span>
      </div>
      <div
        className={[
          "playlist-detail-episode-list",
          "playlist-detail-episode-list-grid",
          isCompactGrid ? "playlist-detail-episode-list-grid-compact" : ""
        ].filter(Boolean).join(" ")}
      >
        {episodes.map((episode, index) => (
          <button
            key={episode.episodeKey}
            type="button"
            className="playlist-detail-episode-item"
            aria-label={episode.title}
            aria-pressed={index === currentEpisodeIndex}
            onClick={() => onSelect(index)}
          >
            <span className="playlist-detail-episode-title">{episode.title}</span>
            <span className="playlist-detail-episode-meta">
              {episode.lastPlayedSeconds > 0 ? `Resume ${Math.floor(episode.lastPlayedSeconds)}s` : `Episode ${index + 1}`}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
