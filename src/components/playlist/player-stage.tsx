"use client";

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
  preferredLinkType,
  onStopWatching
}: {
  episode: Episode | null;
  preferredLinkType: "m3u8" | "embed";
  onStopWatching: (seconds: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const url = (preferredLinkType === "embed" ? episode?.embedUrl ?? episode?.m3u8Url : episode?.m3u8Url ?? episode?.embedUrl) ?? null;
  const useNative = isM3u8(url);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url || !useNative) return;

    let hls: Hls | null = null;
    if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
    }

    const onLoadedMetadata = () => {
      if (episode?.lastPlayedSeconds) video.currentTime = episode.lastPlayedSeconds;
      video.play().catch(() => undefined);
    };

    const stop = () => onStopWatching(video.currentTime);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("pause", stop);
    window.addEventListener("pagehide", stop);

    return () => {
      stop();
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("pause", stop);
      window.removeEventListener("pagehide", stop);
      hls?.destroy();
    };
  }, [episode?.episodeKey, episode?.lastPlayedSeconds, onStopWatching, url, useNative]);

  if (!episode || !url) {
    return <div className="blank-state">No episode loaded.</div>;
  }

  if (useNative) {
    return <video ref={videoRef} controls autoPlay />;
  }

  return <iframe src={url} allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />;
}
