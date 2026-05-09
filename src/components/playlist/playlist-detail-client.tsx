"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import { EpisodeList } from "./episode-list";
import { PlayerStage } from "./player-stage";
import { SourceSwitcher } from "./source-switcher";
import { Toast } from "./toast";

type Episode = {
  id: string;
  episodeKey: string;
  title: string;
  embedUrl: string | null;
  m3u8Url: string | null;
  lastPlayedSeconds: number;
};

type Source = {
  id: string;
  sourceTitle: string;
  preferredLinkType: "m3u8" | "embed";
  version: number;
  episodes: Episode[];
};

type PlaylistDetail = {
  id: string;
  title: string;
  version: number;
  sources: Source[];
};

export function PlaylistDetailClient({
  playlist,
  initialPlayback
}: {
  playlist: PlaylistDetail;
  initialPlayback: { sourceId: string | null; episodeIndex: number };
}) {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [currentSourceId, setCurrentSourceId] = useState<string | null>(initialPlayback.sourceId ?? playlist.sources[0]?.id ?? null);
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(initialPlayback.episodeIndex);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [episodeViewMode, setEpisodeViewMode] = useState<"list" | "grid">("list");
  const [toast, setToast] = useState<string | null>(null);

  const currentSource = playlist.sources.find((source) => source.id === currentSourceId) ?? playlist.sources[0] ?? null;
  const currentEpisode = currentSource?.episodes[currentEpisodeIndex] ?? null;

  const selectEpisode = useCallback((index: number) => {
    if (!currentSource || !currentSource.episodes[index]) return;
    setCurrentEpisodeIndex(index);
    router.push(`/playlist/${playlist.id}?source=${currentSource.id}&episode=${index}`);
  }, [currentSource, playlist.id, router]);

  const switchSource = (nextSourceId: string) => {
    const nextSource = playlist.sources.find((source) => source.id === nextSourceId);
    if (!nextSource) return;

    if (!nextSource.episodes[currentEpisodeIndex]) {
      setToast("Episode does not exist in that source");
      window.setTimeout(() => setToast(null), 2500);
      return;
    }

    setCurrentSourceId(nextSource.id);
    router.push(`/playlist/${playlist.id}?source=${nextSource.id}&episode=${currentEpisodeIndex}`);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;

    if (event.ctrlKey && event.altKey && event.code === "KeyX") {
      if (!currentSource) return;
      event.preventDefault();
      selectEpisode(Math.min(currentEpisodeIndex + 1, currentSource.episodes.length - 1));
    }
  };

  useEffect(() => {
    wrapperRef.current?.focus();
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="fullscreen-wrapper"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onMouseDown={() => wrapperRef.current?.focus()}
      aria-label="Playlist detail"
    >
      <div className="counter-overlay">
        {playlist.title} · {currentSource ? `${currentEpisodeIndex + 1}/${currentSource.episodes.length}` : "0/0"}
      </div>

      <PlayerStage
        episode={currentEpisode}
        preferredLinkType={currentSource?.preferredLinkType ?? "embed"}
        onStopWatching={() => undefined}
      />

      <div className="action-hover-zone">
        <button
          type="button"
          className="action-btn"
          aria-label={isEditorOpen ? "Close editor" : "Open editor"}
          onClick={() => setIsEditorOpen((open) => !open)}
        >
          {isEditorOpen ? "Close" : "Edit"}
        </button>
      </div>

      <div className="playlist-detail-dock">
        <SourceSwitcher
          sources={playlist.sources}
          currentSourceId={currentSource?.id ?? null}
          onSwitch={switchSource}
        />
        <EpisodeList
          episodes={currentSource?.episodes ?? []}
          currentEpisodeIndex={currentEpisodeIndex}
          onSelect={selectEpisode}
          viewMode={episodeViewMode}
          onViewModeChange={setEpisodeViewMode}
        />
        {isEditorOpen ? (
          <section className="playlist-detail-panel playlist-detail-editor-stub" aria-label="Editor drawer placeholder">
            <div className="playlist-detail-panel-header">
              <span>Editor</span>
            </div>
            <p>Editor tools land in Task 9.</p>
          </section>
        ) : null}
      </div>

      <Toast message={toast} />
    </div>
  );
}
