"use client";

type Episode = {
  episodeKey: string;
  title: string;
  lastPlayedSeconds: number;
};

export function EpisodeList({
  episodes,
  currentEpisodeIndex,
  onSelect,
  viewMode,
  onViewModeChange
}: {
  episodes: Episode[];
  currentEpisodeIndex: number;
  onSelect: (index: number) => void;
  viewMode: "list" | "grid";
  onViewModeChange: (mode: "list" | "grid") => void;
}) {
  return (
    <section className="playlist-detail-panel playlist-detail-episode-panel" aria-label="Episode list">
      <div className="playlist-detail-panel-header">
        <span>Episodes</span>
        <div className="playlist-detail-segmented-control" role="group" aria-label="Episode view mode">
          <button
            type="button"
            className="playlist-detail-segment"
            aria-pressed={viewMode === "list"}
            onClick={() => onViewModeChange("list")}
          >
            List
          </button>
          <button
            type="button"
            className="playlist-detail-segment"
            aria-pressed={viewMode === "grid"}
            onClick={() => onViewModeChange("grid")}
          >
            Grid
          </button>
        </div>
      </div>
      <div className={`playlist-detail-episode-list playlist-detail-episode-list-${viewMode}`}>
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
