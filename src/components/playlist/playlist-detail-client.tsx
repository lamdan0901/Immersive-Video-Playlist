"use client";

import { House, Library, List, Pencil, StepForward, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import { refreshSourceFromImportedJson } from "@/actions/import";
import { savePlaybackProgress } from "@/actions/playback";
import { softDeleteSource } from "@/actions/playlists";
import { performClientRefresh } from "@/lib/client-refresh";
import { EditorDrawer } from "./editor-drawer";
import { EpisodeList } from "./episode-list";
import { PlayerStage } from "./player-stage";
import { Toast } from "./toast";

type Episode = {
  id: string;
  episodeKey: string;
  title: string;
  slug?: string | null;
  filename?: string | null;
  embedUrl: string | null;
  m3u8Url: string | null;
  lastPlayedSeconds: number;
  sortOrder: number;
};

type Source = {
  id: string;
  sourceKey: string;
  sourceTitle: string;
  sourceUrl: string;
  preferredLinkType: "m3u8" | "embed";
  sortOrder: number;
  version: number;
  episodes: Episode[];
};

type PlaylistDetail = {
  id: string;
  title: string;
  skipStartSeconds: number;
  version: number;
  sources: Source[];
};

export function PlaylistDetailClient({
  playlist,
  initialPlayback,
  allPlaylists = [],
}: {
  playlist: PlaylistDetail;
  initialPlayback: { sourceId: string | null; episodeIndex: number };
  allPlaylists?: { id: string; title: string }[];
}) {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [currentSourceId, setCurrentSourceId] = useState<string | null>(
    initialPlayback.sourceId ?? playlist.sources[0]?.id ?? null,
  );
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(
    initialPlayback.episodeIndex,
  );
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [deletedSourceIds, setDeletedSourceIds] = useState<Set<string>>(new Set());

  const visibleSources = playlist.sources.filter((s) => !deletedSourceIds.has(s.id));

  const handleClientRefresh = useCallback(
    async (sourceId: string, sourceUrl: string): Promise<string> => {
      const source = playlist.sources.find((s) => s.id === sourceId);
      if (!source) {
        return "Source not found.";
      }

      const adminSecret = window.localStorage.getItem("adminSecret");
      if (!adminSecret) {
        return "Admin unlock required";
      }

      try {
        const result = await performClientRefresh(
          {
            sourceKey: source.sourceKey,
            sourceTitle: source.sourceTitle,
            sortOrder: source.sortOrder,
            sourceUrl,
          },
          source.episodes,
        );

        const persisted = await refreshSourceFromImportedJson({
          adminSecret,
          playlistId: playlist.id,
          sourceId: source.id,
          sourceUrl: result.sourceUrl,
          importedJson: result.importedJson,
        });

        if (!persisted.ok) {
          console.error("[PlaylistDetailClient] refresh failed:", persisted.error);
          return persisted.error;
        }

        router.refresh();
        return persisted.data.message;
      } catch (error) {
        console.error("[PlaylistDetailClient] refresh failed:", error);
        const message =
          error instanceof Error && error.message.trim()
            ? error.message
            : "Refresh failed";
        return message;
      }
    },
    [playlist.id, playlist.sources, router],
  );

  const deleteSource = useCallback(
    async (sourceId: string) => {
      const source = playlist.sources.find((s) => s.id === sourceId);
      if (!source) return;

      const adminSecret = window.localStorage.getItem("adminSecret");
      if (!adminSecret) {
        setToast("Admin unlock required");
        window.setTimeout(() => setToast(null), 2500);
        return;
      }

      setDeletedSourceIds((prev) => new Set(prev).add(sourceId));

      if (currentSourceId === sourceId) {
        const nextSource = visibleSources.find((s) => s.id !== sourceId);
        if (nextSource) {
          setCurrentSourceId(nextSource.id);
          router.push(
            `/playlist/${playlist.id}?source=${nextSource.id}&episode=0`,
          );
        } else {
          setCurrentSourceId(null);
        }
      }

      const result = await softDeleteSource({
        adminSecret,
        playlistId: playlist.id,
        playlistVersion: playlist.version,
        sourceId: source.id,
        sourceVersion: source.version,
      });

      if (!result.ok) {
        setDeletedSourceIds((prev) => {
          const next = new Set(prev);
          next.delete(sourceId);
          return next;
        });
        setToast(result.error);
        window.setTimeout(() => setToast(null), 2500);
      } else {
        router.refresh();
      }
    },
    [playlist, currentSourceId, visibleSources, router],
  );

  const currentSource =
    playlist.sources.find((source) => source.id === currentSourceId) ??
    playlist.sources[0] ??
    null;
  const currentEpisode = currentSource?.episodes[currentEpisodeIndex] ?? null;
  const hasNextEpisode = currentSource
    ? currentEpisodeIndex < currentSource.episodes.length - 1
    : false;
  const episodePlaybackKey =
    currentSource && currentEpisode
      ? `${currentSource.id}:${currentEpisode.episodeKey}`
      : null;
  const optimisticProgressRef = useRef<Record<string, number>>({});
  const optimisticSeconds = episodePlaybackKey
    ? optimisticProgressRef.current[episodePlaybackKey]
    : undefined;
  const currentEpisodeLastPlayedSeconds = Math.max(
    currentEpisode?.lastPlayedSeconds ?? 0,
    optimisticSeconds ?? 0,
  );
  const currentEpisodeForPlayer = currentEpisode
    ? {
        ...currentEpisode,
        lastPlayedSeconds: currentEpisodeLastPlayedSeconds,
      }
    : null;

  const onStopWatching = useCallback(
    (input: { sourceId: string; episodeKey: string; seconds: number }) => {
      const playbackKey = `${input.sourceId}:${input.episodeKey}`;
      const nextSeconds = Number.isFinite(input.seconds)
        ? Math.max(0, Math.floor(input.seconds))
        : 0;
      const highestKnownSeconds =
        optimisticProgressRef.current[playbackKey] ?? -1;
      if (nextSeconds <= highestKnownSeconds) return;
      optimisticProgressRef.current[playbackKey] = nextSeconds;

      void savePlaybackProgress({
        playlistId: playlist.id,
        sourceId: input.sourceId,
        episodeKey: input.episodeKey,
        seconds: nextSeconds,
      }).catch(() => {
        if (optimisticProgressRef.current[playbackKey] === nextSeconds) {
          delete optimisticProgressRef.current[playbackKey];
        }
      });
    },
    [playlist.id],
  );

  const selectEpisode = useCallback(
    (index: number) => {
      if (!currentSource || !currentSource.episodes[index]) return;
      setCurrentEpisodeIndex(index);
      router.push(
        `/playlist/${playlist.id}?source=${currentSource.id}&episode=${index}`,
      );
    },
    [currentSource, playlist.id, router],
  );

  const goToNextEpisode = useCallback(() => {
    if (!hasNextEpisode) return;
    selectEpisode(currentEpisodeIndex + 1);
  }, [currentEpisodeIndex, hasNextEpisode, selectEpisode]);

  const switchSource = (nextSourceId: string) => {
    const nextSource = playlist.sources.find(
      (source) => source.id === nextSourceId,
    );
    if (!nextSource) return;

    if (!nextSource.episodes[currentEpisodeIndex]) {
      setToast("Episode does not exist in that source");
      window.setTimeout(() => setToast(null), 2500);
      return;
    }

    setCurrentSourceId(nextSource.id);
    router.push(
      `/playlist/${playlist.id}?source=${nextSource.id}&episode=${currentEpisodeIndex}`,
    );
  };

  const closeEditor = useCallback(() => {
    setIsEditorOpen(false);
  }, []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.code === "Escape" && isEditorOpen) {
      event.preventDefault();
      closeEditor();
      return;
    }

    const target = event.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT"
    )
      return;

    if (event.ctrlKey && !event.altKey && event.code === "KeyE") {
      event.preventDefault();
      setIsEditorOpen((open) => !open);
      return;
    }

    if (event.ctrlKey && !event.altKey && event.code === "KeyX") {
      event.preventDefault();
      goToNextEpisode();
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
      onMouseDown={(event) => {
        wrapperRef.current?.focus();
        if (isEditorOpen && event.target === event.currentTarget) {
          closeEditor();
        }
      }}
      aria-label="Playlist detail"
    >
      <div className="counter-overlay">
        <button
          type="button"
          className="counter-overlay-btn"
          aria-label="Back to home"
          onClick={() => router.push("/")}
        >
          <House aria-hidden="true" size={16} strokeWidth={2.2} />
        </button>
        <span>
          {currentSource
            ? `${currentEpisodeIndex + 1}/${currentSource.episodes.length}`
            : "0/0"}
        </span>
      </div>

      <PlayerStage
        episode={currentEpisodeForPlayer}
        sourceId={currentSource?.id ?? null}
        preferredLinkType={currentSource?.preferredLinkType ?? "embed"}
        skipStartSeconds={playlist.skipStartSeconds}
        onStopWatching={onStopWatching}
      />

      <div className="action-hover-zone">
        {hasNextEpisode ? (
          <button
            type="button"
            className="action-btn action-btn-next"
            aria-label="Next episode"
            onClick={goToNextEpisode}
          >
            <StepForward aria-hidden="true" size={18} strokeWidth={2.2} />
          </button>
        ) : null}
        <button
          type="button"
          className="action-btn action-btn-edit"
          aria-label={isEditorOpen ? "Close editor" : "Open editor"}
          onClick={() => setIsEditorOpen((open) => !open)}
        >
          <Pencil aria-hidden="true" size={18} strokeWidth={2.2} />
        </button>
        {visibleSources.length > 0 ? (
          <div className="action-source-control">
            <button
              type="button"
              className="action-source-trigger"
              aria-label="Select source"
            >
              <List aria-hidden="true" size={18} strokeWidth={2.2} />
            </button>
            <div className="action-source-select-panel" aria-label="Sources">
              <span>Sources</span>
              <div className="action-source-list">
                {visibleSources.map((source) => (
                  <div key={source.id} className="action-source-item">
                    <button
                      type="button"
                      className="action-source-item-main"
                      aria-pressed={source.id === currentSource?.id}
                      onClick={() => switchSource(source.id)}
                    >
                      <span className="action-source-item-title">
                        {source.sourceTitle}
                      </span>
                      <span className="action-source-item-meta">
                        {source.episodes.length} ep ·{" "}
                        {source.preferredLinkType.toUpperCase()}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="action-source-item-delete"
                      aria-label={`Delete ${source.sourceTitle}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSource(source.id);
                      }}
                    >
                      <Trash2 aria-hidden="true" size={14} strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
        {allPlaylists.length > 1 ? (
          <div className="action-playlist-control">
            <button
              type="button"
              className="action-playlist-trigger"
              aria-label="Select playlist"
            >
              <Library aria-hidden="true" size={18} strokeWidth={2.2} />
            </button>
            <div
              className="action-playlist-select-panel"
              aria-label="Playlists"
            >
              <span>Playlists</span>
              <div className="action-playlist-list">
                {allPlaylists
                  .filter((p) => p.id !== playlist.id)
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="action-playlist-item"
                      onClick={() => router.push(`/playlist/${p.id}`)}
                    >
                      <span className="action-playlist-item-title">
                        {p.title}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {isEditorOpen ? (
        <div
          className="playlist-detail-editor-overlay"
          onMouseDown={closeEditor}
        >
          <div
            className="playlist-detail-dock"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <EpisodeList
              episodes={currentSource?.episodes ?? []}
              currentEpisodeIndex={currentEpisodeIndex}
              onSelect={selectEpisode}
            />
            <EditorDrawer
              key={`${playlist.id}:${playlist.version}:${currentSource?.id ?? "no-source"}:${currentSource?.version ?? 0}`}
              playlist={{
                id: playlist.id,
                title: playlist.title,
                skipStartSeconds: playlist.skipStartSeconds,
                version: playlist.version,
              }}
              source={
                currentSource
                  ? {
                      id: currentSource.id,
                      sourceTitle: currentSource.sourceTitle,
                      sourceUrl: currentSource.sourceUrl,
                      preferredLinkType: currentSource.preferredLinkType,
                      version: currentSource.version,
                    }
                  : null
              }
              onRefresh={handleClientRefresh}
            />
          </div>
        </div>
      ) : null}

      <Toast message={toast} />
    </div>
  );
}
