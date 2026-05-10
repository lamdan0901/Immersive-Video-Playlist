"use client";

type Source = {
  id: string;
  sourceTitle: string;
  preferredLinkType: "m3u8" | "embed";
  episodes: { episodeKey: string }[];
};

export function SourceSwitcher({
  sources,
  currentSourceId,
  onSwitch
}: {
  sources: Source[];
  currentSourceId: string | null;
  onSwitch: (sourceId: string) => void;
}) {
  return (
    <section className="playlist-detail-panel playlist-detail-source-panel" aria-label="Source switcher">
      <div className="playlist-detail-panel-header">
        <span>Sources</span>
      </div>
      <div className="playlist-detail-source-list">
        {sources.map((source) => (
          <button
            key={source.id}
            type="button"
            className="playlist-detail-chip"
            aria-label={source.sourceTitle}
            aria-pressed={source.id === currentSourceId}
            onClick={() => onSwitch(source.id)}
          >
            <span>{source.sourceTitle}</span>
            <span className="playlist-detail-chip-meta">
              {source.episodes.length} ep · {source.preferredLinkType.toUpperCase()}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
