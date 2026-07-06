import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlayerStage } from "./player-stage";

const { savePlaylistVolumeMock } = vi.hoisted(() => ({
  savePlaylistVolumeMock: vi.fn(),
}));

vi.mock("@/actions/playback", () => ({
  savePlaylistVolume: savePlaylistVolumeMock,
}));

vi.mock("hls.js", () => ({
  default: class Hls {
    static isSupported() {
      return false;
    }

    loadSource() {}

    attachMedia() {}

    destroy() {}
  },
}));

describe("PlayerStage", () => {
  it("toggles playback when Space is pressed", () => {
    const { container } = render(
      <PlayerStage
        episode={{
          episodeKey: "episode-1",
          title: "Episode 1",
          embedUrl: null,
          m3u8Url: "https://video.test/episode-1.m3u8",
          lastPlayedSeconds: 0,
        }}
        sourceId="source-1"
        preferredLinkType="m3u8"
        skipStartSeconds={0}
        onStopWatching={vi.fn()}
        playlistId="playlist-1"
      />,
    );

    const video = container.querySelector("video");

    expect(video).not.toBeNull();

    if (!video) {
      throw new Error("Expected video element to render");
    }

    let paused = true;
    const play = vi.fn(() => {
      paused = false;
      return Promise.resolve();
    });
    const pause = vi.fn(() => {
      paused = true;
    });

    Object.defineProperty(video, "paused", {
      configurable: true,
      get: () => paused,
    });
    Object.defineProperty(video, "play", {
      configurable: true,
      value: play,
    });
    Object.defineProperty(video, "pause", {
      configurable: true,
      value: pause,
    });

    const playEvent = new KeyboardEvent("keydown", {
      code: "Space",
      key: " ",
      cancelable: true,
    });
    window.dispatchEvent(playEvent);

    expect(playEvent.defaultPrevented).toBe(true);
    expect(play).toHaveBeenCalledTimes(1);
    expect(pause).not.toHaveBeenCalled();

    const pauseEvent = new KeyboardEvent("keydown", {
      code: "Space",
      key: " ",
      cancelable: true,
    });
    window.dispatchEvent(pauseEvent);

    expect(pauseEvent.defaultPrevented).toBe(true);
    expect(pause).toHaveBeenCalledTimes(1);
  });
});
