"use client";

import { savePlaylistVolume } from "@/actions/playback";
import Hls from "hls.js";
import { useEffect, useRef } from "react";

type Episode = {
  episodeKey: string;
  title: string;
  embedUrl: string | null;
  m3u8Url: string | null;
  lastPlayedSeconds: number;
};

function isM3u8(url: string | null) {
  return Boolean(url && /\.m3u8(\?|$)/i.test(url));
}

export function PlayerStage({
  episode,
  sourceId,
  preferredLinkType,
  skipStartSeconds,
  onStopWatching,
  playlistId,
  initialVolume = 1,
}: {
  episode: Episode | null;
  sourceId: string | null;
  preferredLinkType: "m3u8" | "embed";
  skipStartSeconds: number;
  onStopWatching: (input: { sourceId: string; episodeKey: string; seconds: number }) => void;
  playlistId: string;
  initialVolume?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const volumeSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const url = (preferredLinkType === "embed" ? episode?.embedUrl ?? episode?.m3u8Url : episode?.m3u8Url ?? episode?.embedUrl) ?? null;
  const useNative = isM3u8(url);
  const episodeKey = episode?.episodeKey ?? null;
  const resumeSeconds = episode?.lastPlayedSeconds ?? 0;

  useEffect(() => {
    if (!url || !episodeKey || !sourceId) return;

    if (!useNative) {
      // For iframes, we can't track progress, but we should record that this episode was started.
      onStopWatching({ sourceId, episodeKey, seconds: resumeSeconds });
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;
    if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
    }

    const onLoadedMetadata = () => {
      const startSeconds = Math.max(resumeSeconds, skipStartSeconds);
      if (startSeconds > 0) video.currentTime = startSeconds;
      if (initialVolume >= 0 && initialVolume <= 1) {
        video.volume = initialVolume;
      }
      video.play().catch(() => undefined);
    };

    const stop = () => onStopWatching({
      sourceId,
      episodeKey,
      seconds: video.currentTime
    });
    const interval = window.setInterval(() => {
      if (!video.paused) {
        stop();
      }
    }, 60000);
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) {
        return;
      }

      if (e.code === "KeyK" || e.key === "k" || e.key === "K") {
        e.preventDefault();
        if (video.paused) {
          video.play().catch(() => undefined);
        } else {
          video.pause();
        }
      } else if (e.code === "KeyL" || e.key === "l" || e.key === "L") {
        e.preventDefault();
        const duration = video.duration;
        const targetTime = video.currentTime + 10;
        video.currentTime =
          typeof duration === "number" && !isNaN(duration) && duration > 0
            ? Math.min(duration, targetTime)
            : targetTime;
      } else if (e.code === "KeyJ" || e.key === "j" || e.key === "J") {
        e.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 10);
      }
    };

    const handleVolumeChange = () => {
      if (volumeSaveTimerRef.current) {
        clearTimeout(volumeSaveTimerRef.current);
      }
      volumeSaveTimerRef.current = setTimeout(() => {
        savePlaylistVolume({ playlistId, volume: video.volume }).catch(() => {});
      }, 300);
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("pause", stop);
    video.addEventListener("volumechange", handleVolumeChange);
    window.addEventListener("pagehide", stop);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      stop();
      window.clearInterval(interval);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("pause", stop);
      video.removeEventListener("volumechange", handleVolumeChange);
      window.removeEventListener("pagehide", stop);
      window.removeEventListener("keydown", handleKeyDown);
      hls?.destroy();
    };
    // Resume seconds should reseed only when the playback target changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeKey, initialVolume, onStopWatching, playlistId, sourceId, url, useNative]);

  if (!episode || !url) {
    return <div className="blank-state">No episode loaded.</div>;
  }

  if (useNative) {
    return <video ref={videoRef} controls autoPlay suppressHydrationWarning />;
  }

  return <iframe src={url} allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />;
}
