import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlaylistDetailClient } from "./playlist-detail-client";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock
  })
}));

vi.mock("hls.js", () => ({
  default: class Hls {
    static isSupported() {
      return false;
    }

    loadSource() {}

    attachMedia() {}

    destroy() {}
  }
}));

const playlist = {
  id: "playlist-1",
  title: "Fate Chooses You",
  version: 1,
  sources: [
    {
      id: "source-a",
      sourceTitle: "Vietsub",
      preferredLinkType: "embed" as const,
      version: 1,
      episodes: [
        {
          id: "episode-a1",
          episodeKey: "ep-a1",
          title: "Episode 1",
          embedUrl: "https://video.test/embed/1",
          m3u8Url: "https://video.test/1.m3u8",
          lastPlayedSeconds: 0
        },
        {
          id: "episode-a2",
          episodeKey: "ep-a2",
          title: "Episode 2",
          embedUrl: "https://video.test/embed/2",
          m3u8Url: "https://video.test/2.m3u8",
          lastPlayedSeconds: 12
        }
      ]
    },
    {
      id: "source-b",
      sourceTitle: "Dubbed",
      preferredLinkType: "embed" as const,
      version: 1,
      episodes: [
        {
          id: "episode-b1",
          episodeKey: "ep-b1",
          title: "Episode 1",
          embedUrl: "https://video.test/embed/b1",
          m3u8Url: "https://video.test/b1.m3u8",
          lastPlayedSeconds: 3
        }
      ]
    }
  ]
};

describe("PlaylistDetailClient", () => {
  beforeEach(() => {
    pushMock.mockReset();
    vi.useFakeTimers();
  });

  it("keeps the current source when the target source does not have the current episode index", () => {
    render(
      <PlaylistDetailClient
        playlist={playlist}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 1 }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Dubbed" }));

    expect(screen.getByRole("status")).toHaveTextContent("Episode does not exist in that source");
    expect(screen.getByRole("button", { name: "Vietsub" })).toHaveAttribute("aria-pressed", "true");
    expect(pushMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("advances to the next episode on Ctrl+Alt+X and updates the route", () => {
    render(
      <PlaylistDetailClient
        playlist={playlist}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 0 }}
      />
    );

    fireEvent.keyDown(screen.getByLabelText("Playlist detail"), {
      code: "KeyX",
      ctrlKey: true,
      altKey: true
    });

    expect(screen.getByRole("button", { name: "Episode 2" })).toHaveAttribute("aria-pressed", "true");
    expect(pushMock).toHaveBeenCalledWith("/playlist/playlist-1?source=source-a&episode=1");
  });

  it("focuses the wrapper on mount", () => {
    render(
      <PlaylistDetailClient
        playlist={playlist}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 0 }}
      />
    );

    const wrapper = screen.getByLabelText("Playlist detail");

    expect(document.activeElement).toBe(wrapper);
  });

  it("ignores the shortcut when there is no current source", () => {
    render(
      <PlaylistDetailClient
        playlist={{ ...playlist, sources: [] }}
        initialPlayback={{ sourceId: null, episodeIndex: 0 }}
      />
    );

    fireEvent.keyDown(screen.getByLabelText("Playlist detail"), {
      code: "KeyX",
      ctrlKey: true,
      altKey: true
    });

    expect(screen.getByText("No episode loaded.")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
