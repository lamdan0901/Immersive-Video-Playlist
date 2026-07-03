"use client";

import { Maximize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import { formatPlaybackTime } from "./format-playback-time";

const CONTROLS_HIDE_DELAY_MS = 2500;

function getClampedProgressRatio(bar: HTMLDivElement, clientX: number) {
  const rect = bar.getBoundingClientRect();

  if (rect.width <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
}

type M3u8PlayerProps = {
  videoRef: RefObject<HTMLVideoElement | null>;
};

export function M3u8Player({ videoRef }: M3u8PlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isScrubbingRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [bufferedRatio, setBufferedRatio] = useState(0);
  const [hoveredRatio, setHoveredRatio] = useState<number | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
      hideControlsTimerRef.current = null;
    }
  }, []);

  const scheduleHideControls = useCallback(
    (playing: boolean) => {
      clearHideTimer();
      if (!playing) {
        setControlsVisible(true);
        return;
      }
      hideControlsTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, CONTROLS_HIDE_DELAY_MS);
    },
    [clearHideTimer],
  );

  const revealControls = useCallback(
    (playing: boolean) => {
      setControlsVisible(true);
      scheduleHideControls(playing);
    },
    [scheduleHideControls],
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const syncBuffered = () => {
      if (!video.duration || !Number.isFinite(video.duration)) {
        setBufferedRatio(0);
        return;
      }
      const end = video.buffered.length > 0 ? video.buffered.end(video.buffered.length - 1) : 0;
      setBufferedRatio(Math.min(1, end / video.duration));
    };

    const onPlay = () => {
      setIsPlaying(true);
      scheduleHideControls(true);
    };
    const onPause = () => {
      setIsPlaying(false);
      revealControls(false);
    };
    const onTimeUpdate = () => {
      if (!isScrubbingRef.current) {
        setCurrentTime(video.currentTime);
      }
      syncBuffered();
    };
    const onLoadedMetadata = () => {
      setDuration(video.duration);
      setCurrentTime(video.currentTime);
      setVolume(video.volume);
      setIsMuted(video.muted);
      syncBuffered();
    };
    const onVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };
    const onDurationChange = () => {
      setDuration(video.duration);
      syncBuffered();
    };
    const onProgress = () => syncBuffered();

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("volumechange", onVolumeChange);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("progress", onProgress);

    setIsPlaying(!video.paused);
    setCurrentTime(video.currentTime);
    setDuration(video.duration);
    setVolume(video.volume);
    setIsMuted(video.muted);
    syncBuffered();

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("volumechange", onVolumeChange);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("progress", onProgress);
      clearHideTimer();
    };
  }, [clearHideTimer, revealControls, scheduleHideControls, videoRef]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [videoRef]);

  const seekToRatio = useCallback(
    (ratio: number) => {
      const video = videoRef.current;
      if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
      const nextTime = Math.max(0, Math.min(video.duration, ratio * video.duration));
      video.currentTime = nextTime;
      setCurrentTime(nextTime);
    },
    [videoRef],
  );

  const updateHoveredRatio = useCallback((bar: HTMLDivElement, clientX: number) => {
    setHoveredRatio(getClampedProgressRatio(bar, clientX));
  }, []);

  const clearHoveredRatio = useCallback(() => {
    if (!isScrubbingRef.current) {
      setHoveredRatio(null);
    }
  }, []);

  const hasDuration = duration > 0 && Number.isFinite(duration);

  const onProgressPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!hasDuration) {
      return;
    }

    updateHoveredRatio(event.currentTarget, event.clientX);
  };

  const onProgressPointerLeave = () => {
    clearHoveredRatio();
  };

  const onProgressPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const bar = event.currentTarget;
    isScrubbingRef.current = true;
    bar.setPointerCapture(event.pointerId);

    const updateFromClientX = (clientX: number) => {
      const ratio = getClampedProgressRatio(bar, clientX);
      setHoveredRatio(ratio);
      seekToRatio(ratio);
    };

    updateFromClientX(event.clientX);

    const onPointerMove = (moveEvent: PointerEvent) => {
      updateFromClientX(moveEvent.clientX);
    };
    const onPointerUp = () => {
      isScrubbingRef.current = false;
      setHoveredRatio(null);
      bar.releasePointerCapture(event.pointerId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  };

  const onVolumeInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const nextVolume = Number(event.target.value);
    video.volume = nextVolume;
    if (nextVolume > 0 && video.muted) {
      video.muted = false;
    }
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement === container) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }
    await container.requestFullscreen().catch(() => undefined);
  };

  const progressRatio = hasDuration ? currentTime / duration : 0;
  const hoveredTime = hoveredRatio !== null && hasDuration ? hoveredRatio * duration : null;

  return (
    <div
      ref={containerRef}
      className={`m3u8-player${controlsVisible ? " m3u8-player--controls-visible" : ""}${isFullscreen ? " m3u8-player--fullscreen" : ""}`}
      onMouseMove={() => revealControls(isPlaying)}
      onMouseLeave={() => scheduleHideControls(isPlaying)}
    >
      <video
        ref={videoRef}
        className="m3u8-player-video"
        autoPlay
        playsInline
        suppressHydrationWarning
        onClick={togglePlay}
      />

      <div className="m3u8-player-gradient" aria-hidden="true" />

      <div className="m3u8-player-controls" onClick={(event) => event.stopPropagation()}>
        <div
          className="m3u8-player-progress"
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={currentTime}
          onPointerMove={onProgressPointerMove}
          onPointerLeave={onProgressPointerLeave}
          onPointerDown={onProgressPointerDown}
        >
          {hoveredTime !== null ? (
            <span
              className="m3u8-player-progress-tooltip"
              style={
                {
                  "--m3u8-player-hover-ratio": hoveredRatio,
                } as CSSProperties
              }
            >
              {formatPlaybackTime(hoveredTime)}
            </span>
          ) : null}
          <div className="m3u8-player-progress-buffer" style={{ width: `${bufferedRatio * 100}%` }} />
          <div className="m3u8-player-progress-played" style={{ width: `${progressRatio * 100}%` }}>
            <span className="m3u8-player-progress-thumb" />
          </div>
        </div>

        <div className="m3u8-player-bar">
          <div className="m3u8-player-bar-left">
            <button
              type="button"
              className="m3u8-player-icon-btn"
              aria-label={isPlaying ? "Pause" : "Play"}
              onClick={togglePlay}
            >
              {isPlaying ? (
                <Pause aria-hidden="true" size={22} strokeWidth={2} />
              ) : (
                <Play aria-hidden="true" size={22} strokeWidth={2} />
              )}
            </button>

            <div className="m3u8-player-volume">
              <button
                type="button"
                className="m3u8-player-icon-btn"
                aria-label={isMuted || volume === 0 ? "Unmute" : "Mute"}
                onClick={toggleMute}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX aria-hidden="true" size={22} strokeWidth={2} />
                ) : (
                  <Volume2 aria-hidden="true" size={22} strokeWidth={2} />
                )}
              </button>
              <input
                className="m3u8-player-volume-slider"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                aria-label="Volume"
                onChange={onVolumeInput}
              />
            </div>

            <span className="m3u8-player-time">
              {formatPlaybackTime(currentTime)} / {formatPlaybackTime(duration)}
            </span>
          </div>

          <button
            type="button"
            className="m3u8-player-icon-btn"
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            onClick={toggleFullscreen}
          >
            <Maximize aria-hidden="true" size={22} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
