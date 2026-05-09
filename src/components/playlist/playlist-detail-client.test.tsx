import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlaylistDetailClient } from "./playlist-detail-client";

const pushMock = vi.fn();
const refreshMock = vi.fn();
const { savePlaybackProgressMock } = vi.hoisted(() => ({
  savePlaybackProgressMock: vi.fn()
}));

vi.mock("@/actions/playlists", () => ({
  createBlankSource: vi.fn(),
  softDeleteSource: vi.fn(),
  updatePlaylistTitle: vi.fn(),
  updateSource: vi.fn()
}));

vi.mock("@/actions/import", () => ({
  refreshSource: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock
  })
}));

vi.mock("@/actions/playback", () => ({
  savePlaybackProgress: savePlaybackProgressMock
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
      sourceUrl: "https://video.test/source-a.json",
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
      sourceUrl: "https://video.test/source-b.json",
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
    refreshMock.mockReset();
    savePlaybackProgressMock.mockReset();
    savePlaybackProgressMock.mockResolvedValue(undefined);
    vi.useFakeTimers();
  });

  it("renders the editor drawer with playlist and source fields", () => {
    render(
      <PlaylistDetailClient
        playlist={playlist}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 0 }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Open editor" }));

    expect(screen.getByRole("heading", { name: "Editor" })).toBeInTheDocument();
    expect(screen.getByLabelText("Playlist title")).toHaveValue("Fate Chooses You");
    expect(screen.getByLabelText("Source title")).toHaveValue("Vietsub");
    expect(screen.getByLabelText("Source URL")).toHaveValue("https://video.test/source-a.json");
    expect(screen.getByLabelText("Preferred link type")).toHaveValue("embed");
    expect(screen.getByRole("button", { name: "Create New Source" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh Source" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Source" })).toBeInTheDocument();
    expect(screen.getByText("Advanced JSON")).toBeInTheDocument();
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

  it("saves playback progress when stopping after the watched position changes", () => {
    const { container } = render(
      <PlaylistDetailClient
        playlist={{
          ...playlist,
          sources: playlist.sources.map((source) => ({
            ...source,
            preferredLinkType: "m3u8" as const
          }))
        }}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 1 }}
      />
    );

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    if (!video) return;
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      value: 47
    });

    fireEvent.pause(video);

    expect(savePlaybackProgressMock).toHaveBeenCalledWith({
      playlistId: "playlist-1",
      sourceId: "source-a",
      episodeKey: "ep-a2",
      seconds: 47
    });
  });

  it("does not save playback progress on unrelated rerenders", () => {
    const { container } = render(
      <PlaylistDetailClient
        playlist={{
          ...playlist,
          sources: playlist.sources.map((source) => ({
            ...source,
            preferredLinkType: "m3u8" as const
          }))
        }}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 1 }}
      />
    );

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    if (!video) return;
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      value: 47
    });

    fireEvent.click(screen.getByRole("button", { name: "Open editor" }));

    expect(savePlaybackProgressMock).not.toHaveBeenCalled();
  });

  it("does not resend the same playback second after an interval save in one session", () => {
    const { container, unmount } = render(
      <PlaylistDetailClient
        playlist={{
          ...playlist,
          sources: playlist.sources.map((source) => ({
            ...source,
            preferredLinkType: "m3u8" as const
          }))
        }}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 1 }}
      />
    );

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    if (!video) return;

    let currentTime = 60;
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      get: () => currentTime
    });
    Object.defineProperty(video, "paused", {
      configurable: true,
      get: () => false
    });

    act(() => {
      vi.advanceTimersByTime(60000);
    });

    currentTime = 61;

    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(savePlaybackProgressMock).toHaveBeenNthCalledWith(1, {
      playlistId: "playlist-1",
      sourceId: "source-a",
      episodeKey: "ep-a2",
      seconds: 60
    });
    expect(savePlaybackProgressMock).toHaveBeenNthCalledWith(2, {
      playlistId: "playlist-1",
      sourceId: "source-a",
      episodeKey: "ep-a2",
      seconds: 61
    });

    Object.defineProperty(video, "paused", {
      configurable: true,
      get: () => true
    });

    fireEvent.pause(video);
    unmount();

    expect(savePlaybackProgressMock).toHaveBeenCalledTimes(2);
  });

  it("resumes from optimistic progress when revisiting an episode in the same session", () => {
    const { container } = render(
      <PlaylistDetailClient
        playlist={{
          ...playlist,
          sources: playlist.sources.map((source) => ({
            ...source,
            preferredLinkType: "m3u8" as const
          }))
        }}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 1 }}
      />
    );

    let currentTime = 0;
    const installVideoState = () => {
      const video = container.querySelector("video");
      expect(video).not.toBeNull();
      if (!video) return null;
      Object.defineProperty(video, "currentTime", {
        configurable: true,
        get: () => currentTime,
        set: (value: number) => {
          currentTime = value;
        }
      });
      Object.defineProperty(video, "play", {
        configurable: true,
        value: vi.fn(() => Promise.resolve())
      });
      return video;
    };

    const initialVideo = installVideoState();
    if (!initialVideo) return;

    currentTime = 60;
    fireEvent.pause(initialVideo);

    fireEvent.click(screen.getByRole("button", { name: "Episode 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Episode 2" }));
    const revisitedVideo = installVideoState();
    if (!revisitedVideo) return;
    fireEvent.loadedMetadata(revisitedVideo);

    expect(currentTime).toBe(60);
  });

  it("saves progress to the old episode before switching episodes", () => {
    const { container } = render(
      <PlaylistDetailClient
        playlist={{
          ...playlist,
          sources: playlist.sources.map((source) => ({
            ...source,
            preferredLinkType: "m3u8" as const
          }))
        }}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 1 }}
      />
    );

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    if (!video) return;
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      value: 44
    });

    fireEvent.click(screen.getByRole("button", { name: "Episode 1" }));

    expect(savePlaybackProgressMock).toHaveBeenCalledWith({
      playlistId: "playlist-1",
      sourceId: "source-a",
      episodeKey: "ep-a2",
      seconds: 44
    });
  });

  it("retries the same second after a failed playback save", async () => {
    savePlaybackProgressMock.mockRejectedValueOnce(new Error("save failed"));
    savePlaybackProgressMock.mockResolvedValue(undefined);

    const { container } = render(
      <PlaylistDetailClient
        playlist={{
          ...playlist,
          sources: playlist.sources.map((source) => ({
            ...source,
            preferredLinkType: "m3u8" as const
          }))
        }}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 1 }}
      />
    );

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    if (!video) return;
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      value: 47
    });

    fireEvent.pause(video);
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.pause(video);

    expect(savePlaybackProgressMock).toHaveBeenCalledTimes(2);
  });
});
