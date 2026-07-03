import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { M3u8Player } from "./m3u8-player";

function renderPlayer() {
  const videoRef = createRef<HTMLVideoElement>();
  const view = render(<M3u8Player videoRef={videoRef} />);
  const video = view.container.querySelector("video");
  const progress = view.container.querySelector(".m3u8-player-progress");

  expect(video).not.toBeNull();
  expect(progress).not.toBeNull();

  if (!video || !progress) {
    throw new Error("Expected video and progress elements to render");
  }

  Object.defineProperty(video, "duration", {
    configurable: true,
    value: 120,
  });
  Object.defineProperty(video, "currentTime", {
    configurable: true,
    value: 0,
    writable: true,
  });
  Object.defineProperty(video, "volume", {
    configurable: true,
    value: 1,
    writable: true,
  });
  Object.defineProperty(video, "muted", {
    configurable: true,
    value: false,
    writable: true,
  });
  Object.defineProperty(video, "buffered", {
    configurable: true,
    value: {
      length: 0,
      end: () => 0,
    },
  });
  Object.defineProperty(progress, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 6,
      right: 200,
      width: 200,
      height: 6,
      toJSON: () => ({}),
    }),
  });
  Object.defineProperty(progress, "setPointerCapture", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(progress, "releasePointerCapture", {
    configurable: true,
    value: vi.fn(),
  });

  fireEvent.loadedMetadata(video);

  return { ...view, video, progress };
}

describe("M3u8Player", () => {
  it("keeps the hover tooltip hidden by default", () => {
    const { container } = renderPlayer();

    expect(
      container.querySelector(".m3u8-player-progress-tooltip"),
    ).not.toBeInTheDocument();
  });

  it("shows the hovered timestamp above the seek bar", () => {
    const { progress } = renderPlayer();

    fireEvent.pointerMove(progress, { clientX: 50 });

    expect(screen.getByText("0:30")).toBeInTheDocument();
  });

  it("keeps the slider hit area outside the visible seek track", () => {
    const { container } = renderPlayer();

    const progress = container.querySelector(".m3u8-player-progress");
    const track = container.querySelector(".m3u8-player-progress-track");
    const buffer = container.querySelector(".m3u8-player-progress-buffer");
    const played = container.querySelector(".m3u8-player-progress-played");
    const thumb = container.querySelector(".m3u8-player-progress-thumb");

    expect(progress).toHaveAttribute("role", "slider");
    expect(progress).toContainElement(track);
    expect(track).toContainElement(buffer);
    expect(track).toContainElement(played);
    expect(played).toContainElement(thumb);
  });

  it("keeps the hover tooltip hidden when the duration is invalid", () => {
    const { container, video, progress } = renderPlayer();

    Object.defineProperty(video, "duration", {
      configurable: true,
      value: Number.NaN,
    });

    fireEvent.durationChange(video);
    fireEvent.pointerMove(progress, { clientX: 80 });

    expect(
      container.querySelector(".m3u8-player-progress-tooltip"),
    ).not.toBeInTheDocument();
  });

  it("still seeks when the progress bar is pressed", () => {
    const { video, progress } = renderPlayer();

    let currentTime = 0;
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      get: () => currentTime,
      set: (value) => {
        currentTime = value;
      },
    });

    fireEvent.pointerDown(progress, { clientX: 150, pointerId: 1 });

    expect(currentTime).toBe(90);
  });
});
