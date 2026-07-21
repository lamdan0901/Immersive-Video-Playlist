import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAppToast } from "@/lib/app-toast";
import { AppToastHost } from "./toast";
import { PlaylistDetailClient } from "./playlist-detail-client";

const pushMock = vi.fn();
const refreshMock = vi.fn();
const {
  createSourceFromUrlMock,
  performClientRefreshMock,
  refreshSourceFromImportedJsonMock,
  savePlaybackProgressMock,
} = vi.hoisted(() => ({
  createSourceFromUrlMock: vi.fn(),
  performClientRefreshMock: vi.fn(),
  refreshSourceFromImportedJsonMock: vi.fn(),
  savePlaybackProgressMock: vi.fn(),
}));

vi.mock("@/actions/playlists", () => ({
  createBlankSource: vi.fn(),
  softDeleteSource: vi.fn(),
  updatePlaylistTitle: vi.fn(),
  updateSource: vi.fn(),
}));

vi.mock("@/actions/import", () => ({
  createSourceFromUrl: createSourceFromUrlMock,
  createSourceFromImportedJson: vi.fn(),
  refreshSourceFromImportedJson: refreshSourceFromImportedJsonMock,
}));

vi.mock("@/lib/client-refresh", () => ({
  performClientRefresh: performClientRefreshMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

vi.mock("@/actions/playback", () => ({
  savePlaybackProgress: savePlaybackProgressMock,
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

const playlist = {
  id: "playlist-1",
  title: "Fate Chooses You",
  skipStartSeconds: 15,
  version: 1,
  sources: [
    {
      id: "source-a",
      sourceKey: "vietsub",
      sourceTitle: "Vietsub",
      sourceUrl: "https://video.test/source-a.json",
      preferredLinkType: "embed" as const,
      sortOrder: 0,
      version: 1,
      episodes: [
        {
          id: "episode-a1",
          episodeKey: "ep-a1",
          title: "Episode 1",
          embedUrl: "https://video.test/embed/1",
          m3u8Url: "https://video.test/1.m3u8",
          lastPlayedSeconds: 0,
          sortOrder: 0,
        },
        {
          id: "episode-a2",
          episodeKey: "ep-a2",
          title: "Episode 2",
          embedUrl: "https://video.test/embed/2",
          m3u8Url: "https://video.test/2.m3u8",
          lastPlayedSeconds: 12,
          sortOrder: 1,
        },
      ],
    },
    {
      id: "source-b",
      sourceKey: "dubbed",
      sourceTitle: "Dubbed",
      sourceUrl: "https://video.test/source-b.json",
      preferredLinkType: "embed" as const,
      sortOrder: 1,
      version: 1,
      episodes: [
        {
          id: "episode-b1",
          episodeKey: "ep-b1",
          title: "Episode 1",
          embedUrl: "https://video.test/embed/b1",
          m3u8Url: "https://video.test/b1.m3u8",
          lastPlayedSeconds: 3,
          sortOrder: 0,
        },
      ],
    },
  ],
};

function renderWithToast(ui: ReactElement) {
  return render(
    <>
      <AppToastHost />
      {ui}
    </>,
  );
}

function getCornerToast() {
  return document.getElementById("app-corner-toast-root");
}

describe("PlaylistDetailClient", () => {
  beforeEach(() => {
    localStorage.clear();
    createSourceFromUrlMock.mockReset();
    performClientRefreshMock.mockReset();
    pushMock.mockReset();
    refreshMock.mockReset();
    refreshSourceFromImportedJsonMock.mockReset();
    savePlaybackProgressMock.mockReset();
    savePlaybackProgressMock.mockResolvedValue(undefined);
    performClientRefreshMock.mockResolvedValue({
      sourceUrl: "https://video.test/source-a.json",
      importedJson: {
        status: "success",
      },
    });
    refreshSourceFromImportedJsonMock.mockResolvedValue({
      ok: true,
      data: {
        message: "Refreshed source Vietsub.",
      },
    });
    createSourceFromUrlMock.mockResolvedValue({
      ok: true,
      data: { message: 'Created source "video.test" from URL.' },
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      clearAppToast();
    });
    vi.useRealTimers();
  });

  it("hides sources and episodes until the editor is opened", () => {
    renderWithToast(<PlaylistDetailClient
        playlist={playlist}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 0 }}
      />,
    );

    expect(
      screen.queryByRole("region", { name: "Episode list" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Editor" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open editor" }));

    expect(
      screen.getByRole("region", { name: "Episode list" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Editor" })).toBeInTheDocument();
  });

  it("renders the editor drawer with playlist and source fields", () => {
    renderWithToast(<PlaylistDetailClient
        playlist={playlist}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 0 }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open editor" }));

    expect(screen.getByRole("heading", { name: "Editor" })).toBeInTheDocument();
    expect(screen.getByLabelText("Playlist title")).toHaveValue(
      "Fate Chooses You",
    );
    expect(screen.getByLabelText("Skip start minutes")).toHaveValue("0");
    expect(screen.getByLabelText("Skip start seconds")).toHaveValue("15");
    expect(screen.getByLabelText("Source title")).toHaveValue("Vietsub");
    expect(screen.getByLabelText("Source URL")).toHaveValue(
      "https://video.test/source-a.json",
    );
    expect(screen.getByLabelText("Preferred link type")).toHaveValue("embed");
    expect(
      screen.getByRole("button", { name: "Create New Source" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refresh Source" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete Source" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Advanced JSON")).toBeInTheDocument();
    expect(screen.queryByText("Skip start minutes")).not.toBeInTheDocument();
    expect(screen.queryByText("Skip start seconds")).not.toBeInTheDocument();
  });

  it("moves focus to skip-start seconds after entering the minute digit", () => {
    renderWithToast(<PlaylistDetailClient
        playlist={playlist}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 0 }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open editor" }));

    const minutesInput = screen.getByLabelText("Skip start minutes");
    const secondsInput = screen.getByLabelText("Skip start seconds");

    fireEvent.focus(minutesInput);
    fireEvent.change(minutesInput, { target: { value: "2" } });

    expect(minutesInput).toHaveValue("2");
    expect(document.activeElement).toBe(secondsInput);
  });

  it("keeps create-source pending until fetch and save finish, then shows the result", async () => {
    vi.useRealTimers();
    localStorage.setItem("adminSecret", "top-secret");

    let resolveCreate:
      | ((value: { ok: true; data: { message: string } }) => void)
      | undefined;
    createSourceFromUrlMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );

    renderWithToast(<PlaylistDetailClient
        playlist={playlist}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 0 }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open editor" }));

    const sourceUrlInput = screen.getByLabelText("Source URL");
    fireEvent.change(sourceUrlInput, {
      target: { value: "https://video.test/new-source.json" },
    });

    const createButton = screen.getByRole("button", {
      name: "Create New Source",
    });
    fireEvent.click(createButton);

    expect(await screen.findByText("Working...")).toBeInTheDocument();
    expect(getCornerToast()).toHaveTextContent("Creating source...");
    expect(getCornerToast()?.className).toContain("app-corner-toast");
    expect(createButton).toBeDisabled();
    expect(
      screen.queryByText('Created source "video.test" from URL.'),
    ).not.toBeInTheDocument();

    await act(async () => {
      resolveCreate?.({
        ok: true,
        data: { message: 'Created source "video.test" from URL.' },
      });
      await Promise.resolve();
    });

    expect(getCornerToast()).toHaveTextContent(
      'Created source "video.test" from URL.',
    );
    expect(getCornerToast()?.className).toContain("app-corner-toast");
    expect(screen.queryByText("Working...")).not.toBeInTheDocument();
    expect(createSourceFromUrlMock).toHaveBeenCalledWith({
      adminSecret: "top-secret",
      playlistId: "playlist-1",
      playlistVersion: 1,
      sourceUrl: "https://video.test/new-source.json",
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("fetches refresh payloads in the browser and persists them to the server", async () => {
    localStorage.setItem("adminSecret", "top-secret");

    renderWithToast(<PlaylistDetailClient
        playlist={playlist}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 0 }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open editor" }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh Source" }));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(performClientRefreshMock).toHaveBeenCalledWith(
      {
        sourceKey: "vietsub",
        sourceTitle: "Vietsub",
        sortOrder: 0,
        sourceUrl: "https://video.test/source-a.json",
      },
      playlist.sources[0].episodes,
    );
    expect(refreshSourceFromImportedJsonMock).toHaveBeenCalledWith({
      adminSecret: "top-secret",
      playlistId: "playlist-1",
      sourceId: "source-a",
      sourceUrl: "https://video.test/source-a.json",
      importedJson: {
        status: "success",
      },
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(getCornerToast()).toHaveTextContent("Refreshed source Vietsub.");
    expect(getCornerToast()?.className).toContain("app-corner-toast");
  });

  it("logs refresh errors to the console when persistence fails", async () => {
    localStorage.setItem("adminSecret", "top-secret");
    refreshSourceFromImportedJsonMock.mockResolvedValueOnce({
      ok: false,
      error: "Refresh failed upstream",
    });
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    renderWithToast(<PlaylistDetailClient
        playlist={playlist}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 0 }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open editor" }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh Source" }));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[PlaylistDetailClient] refresh failed:",
      "Refresh failed upstream",
    );
    expect(getCornerToast()).toHaveTextContent("Refresh failed upstream");
    expect(getCornerToast()?.className).toContain("app-corner-toast");
    consoleErrorSpy.mockRestore();
  });

  it("selects the full skip-start field value on focus", () => {
    renderWithToast(<PlaylistDetailClient
        playlist={playlist}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 0 }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open editor" }));

    const minutesInput = screen.getByLabelText(
      "Skip start minutes",
    ) as HTMLInputElement;
    const secondsInput = screen.getByLabelText(
      "Skip start seconds",
    ) as HTMLInputElement;

    fireEvent.focus(minutesInput);

    expect(minutesInput.selectionStart).toBe(0);
    expect(minutesInput.selectionEnd).toBe(minutesInput.value.length);

    fireEvent.focus(secondsInput);

    expect(secondsInput.selectionStart).toBe(0);
    expect(secondsInput.selectionEnd).toBe(secondsInput.value.length);
  });

  it("closes the editor when Escape is pressed", () => {
    renderWithToast(<PlaylistDetailClient
        playlist={playlist}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 0 }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open editor" }));
    expect(screen.getByRole("heading", { name: "Editor" })).toBeInTheDocument();

    fireEvent.keyDown(screen.getByLabelText("Playlist detail"), {
      key: "Escape",
      code: "Escape",
    });

    expect(
      screen.queryByRole("heading", { name: "Editor" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open editor" }),
    ).toBeInTheDocument();
  });

  it("closes the editor when clicking outside the dock", () => {
    renderWithToast(<PlaylistDetailClient
        playlist={playlist}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 0 }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open editor" }));
    expect(screen.getByRole("heading", { name: "Editor" })).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByLabelText("Playlist detail"));

    expect(
      screen.queryByRole("heading", { name: "Editor" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open editor" }),
    ).toBeInTheDocument();
  });

  it("navigates back to the home page from the title bar button", () => {
    renderWithToast(<PlaylistDetailClient
        playlist={playlist}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 0 }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Back to home" }));

    expect(pushMock).toHaveBeenCalledWith("/");
    expect(
      screen.getByRole("button", { name: "Back to home" }).nextElementSibling,
    ).toHaveTextContent("1/2");
  });

  it("toggles the editor with Ctrl+E", () => {
    renderWithToast(<PlaylistDetailClient
        playlist={playlist}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 0 }}
      />,
    );

    fireEvent.keyDown(screen.getByLabelText("Playlist detail"), {
      code: "KeyE",
      ctrlKey: true,
    });

    expect(screen.getByRole("heading", { name: "Editor" })).toBeInTheDocument();

    fireEvent.keyDown(screen.getByLabelText("Playlist detail"), {
      code: "KeyE",
      ctrlKey: true,
    });

    expect(
      screen.queryByRole("heading", { name: "Editor" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the current source when the target source does not have the current episode index", () => {
    renderWithToast(<PlaylistDetailClient
        playlist={playlist}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 1 }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open editor" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Dubbed1 ep · EMBED/i }),
    );

    expect(getCornerToast()).toHaveTextContent(
      "Episode does not exist in that source",
    );
    expect(
      screen.getByRole("button", { name: /Vietsub2 ep · EMBED/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(pushMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3200);
    });

    expect(getCornerToast()).toBeNull();
  });

  it("advances to the next episode on Ctrl+X and updates the route", () => {
    renderWithToast(<PlaylistDetailClient
        playlist={playlist}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 0 }}
      />,
    );

    fireEvent.keyDown(screen.getByLabelText("Playlist detail"), {
      code: "KeyX",
      ctrlKey: true,
    });

    expect(screen.getByText("2/2")).toBeInTheDocument();
    expect(pushMock).toHaveBeenCalledWith(
      "/playlist/playlist-1?source=source-a&episode=1",
    );
  });

  it("shows a next episode button when another episode exists and advances on click", () => {
    renderWithToast(<PlaylistDetailClient
        playlist={playlist}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 0 }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Next episode" }));

    expect(screen.getByText("2/2")).toBeInTheDocument();
    expect(pushMock).toHaveBeenCalledWith(
      "/playlist/playlist-1?source=source-a&episode=1",
    );
  });

  it("renders the edit control as an icon button", () => {
    renderWithToast(<PlaylistDetailClient
        playlist={playlist}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 0 }}
      />,
    );

    const editButton = screen.getByRole("button", { name: "Open editor" });
    expect(editButton).toContainHTML("svg");
    expect(editButton).not.toHaveTextContent("Edit");
  });

  it("hides the next episode button on the last episode", () => {
    renderWithToast(<PlaylistDetailClient
        playlist={playlist}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 1 }}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Next episode" }),
    ).not.toBeInTheDocument();
  });

  it("focuses the wrapper on mount", () => {
    renderWithToast(<PlaylistDetailClient
        playlist={playlist}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 0 }}
      />,
    );

    const wrapper = screen.getByLabelText("Playlist detail");

    expect(document.activeElement).toBe(wrapper);
  });

  it("shows only the episode progress counter in the top-left overlay", () => {
    renderWithToast(<PlaylistDetailClient
        playlist={playlist}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 0 }}
      />,
    );

    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(
      screen.queryByText("Fate Chooses You · 1/2"),
    ).not.toBeInTheDocument();
  });

  it("ignores the shortcut when there is no current source", () => {
    renderWithToast(<PlaylistDetailClient
        playlist={{ ...playlist, sources: [] }}
        initialPlayback={{ sourceId: null, episodeIndex: 0 }}
      />,
    );

    fireEvent.keyDown(screen.getByLabelText("Playlist detail"), {
      code: "KeyX",
      ctrlKey: true,
    });

    expect(screen.getByText("No episode loaded.")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("saves playback progress when stopping after the watched position changes", () => {
    const { container } = renderWithToast(<PlaylistDetailClient
        playlist={{
          ...playlist,
          sources: playlist.sources.map((source) => ({
            ...source,
            preferredLinkType: "m3u8" as const,
          })),
        }}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 1 }}
      />,
    );

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    if (!video) return;
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      value: 47,
    });

    fireEvent.pause(video);

    expect(savePlaybackProgressMock).toHaveBeenCalledWith({
      playlistId: "playlist-1",
      sourceId: "source-a",
      episodeKey: "ep-a2",
      seconds: 47,
    });
  });

  it("does not save playback progress on unrelated rerenders", () => {
    const { container } = renderWithToast(<PlaylistDetailClient
        playlist={{
          ...playlist,
          sources: playlist.sources.map((source) => ({
            ...source,
            preferredLinkType: "m3u8" as const,
          })),
        }}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 1 }}
      />,
    );

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    if (!video) return;
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      value: 47,
    });

    fireEvent.click(screen.getByRole("button", { name: "Open editor" }));

    expect(savePlaybackProgressMock).not.toHaveBeenCalled();
  });

  it("does not resend the same playback second after an interval save in one session", () => {
    const { container, unmount } = renderWithToast(<PlaylistDetailClient
        playlist={{
          ...playlist,
          sources: playlist.sources.map((source) => ({
            ...source,
            preferredLinkType: "m3u8" as const,
          })),
        }}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 1 }}
      />,
    );

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    if (!video) return;

    let currentTime = 60;
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      get: () => currentTime,
    });
    Object.defineProperty(video, "paused", {
      configurable: true,
      get: () => false,
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
      seconds: 60,
    });
    expect(savePlaybackProgressMock).toHaveBeenNthCalledWith(2, {
      playlistId: "playlist-1",
      sourceId: "source-a",
      episodeKey: "ep-a2",
      seconds: 61,
    });

    Object.defineProperty(video, "paused", {
      configurable: true,
      get: () => true,
    });

    fireEvent.pause(video);
    unmount();

    expect(savePlaybackProgressMock).toHaveBeenCalledTimes(2);
  });

  it("resumes from optimistic progress when revisiting an episode in the same session", () => {
    const { container } = renderWithToast(<PlaylistDetailClient
        playlist={{
          ...playlist,
          sources: playlist.sources.map((source) => ({
            ...source,
            preferredLinkType: "m3u8" as const,
          })),
        }}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 1 }}
      />,
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
        },
      });
      Object.defineProperty(video, "play", {
        configurable: true,
        value: vi.fn(() => Promise.resolve()),
      });
      return video;
    };

    const initialVideo = installVideoState();
    if (!initialVideo) return;

    currentTime = 60;
    fireEvent.pause(initialVideo);

    fireEvent.click(screen.getByRole("button", { name: "Open editor" }));
    fireEvent.click(screen.getByRole("button", { name: "Episode 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Episode 2" }));
    const revisitedVideo = installVideoState();
    if (!revisitedVideo) return;
    fireEvent.loadedMetadata(revisitedVideo);

    expect(currentTime).toBe(60);
  });

  it("applies playlist skip start when it is ahead of saved progress for native playback", () => {
    const { container } = renderWithToast(<PlaylistDetailClient
        playlist={{
          ...playlist,
          sources: playlist.sources.map((source) => ({
            ...source,
            preferredLinkType: "m3u8" as const,
          })),
        }}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 0 }}
      />,
    );

    let currentTime = 0;
    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    if (!video) return;

    Object.defineProperty(video, "currentTime", {
      configurable: true,
      get: () => currentTime,
      set: (value: number) => {
        currentTime = value;
      },
    });
    Object.defineProperty(video, "play", {
      configurable: true,
      value: vi.fn(() => Promise.resolve()),
    });

    fireEvent.loadedMetadata(video);

    expect(currentTime).toBe(15);
  });

  it("saves progress to the old episode before switching episodes", () => {
    const { container } = renderWithToast(<PlaylistDetailClient
        playlist={{
          ...playlist,
          sources: playlist.sources.map((source) => ({
            ...source,
            preferredLinkType: "m3u8" as const,
          })),
        }}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 1 }}
      />,
    );

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    if (!video) return;
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      value: 44,
    });

    fireEvent.click(screen.getByRole("button", { name: "Open editor" }));
    fireEvent.click(screen.getByRole("button", { name: "Episode 1" }));

    expect(savePlaybackProgressMock).toHaveBeenCalledWith({
      playlistId: "playlist-1",
      sourceId: "source-a",
      episodeKey: "ep-a2",
      seconds: 44,
    });
  });

  it("retries the same second after a failed playback save", async () => {
    savePlaybackProgressMock.mockRejectedValueOnce(new Error("save failed"));
    savePlaybackProgressMock.mockResolvedValue(undefined);

    const { container } = renderWithToast(<PlaylistDetailClient
        playlist={{
          ...playlist,
          sources: playlist.sources.map((source) => ({
            ...source,
            preferredLinkType: "m3u8" as const,
          })),
        }}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 1 }}
      />,
    );

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    if (!video) return;
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      value: 47,
    });

    fireEvent.pause(video);
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.pause(video);

    expect(savePlaybackProgressMock).toHaveBeenCalledTimes(2);
  });

  it("skips forward 10 seconds on L keypress and backward 10 seconds on J keypress", () => {
    const { container } = renderWithToast(<PlaylistDetailClient
        playlist={{
          ...playlist,
          sources: playlist.sources.map((source) => ({
            ...source,
            preferredLinkType: "m3u8" as const,
          })),
        }}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 1 }}
      />,
    );

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    if (!video) return;

    let currentTime = 50;
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      get: () => currentTime,
      set: (val) => {
        currentTime = val;
      },
    });

    Object.defineProperty(video, "duration", {
      configurable: true,
      value: 100,
    });

    // Fire keydown 'L' on window
    fireEvent.keyDown(window, { code: "KeyL", key: "L" });
    expect(currentTime).toBe(60);

    // Fire keydown 'J' on window
    fireEvent.keyDown(window, { code: "KeyJ", key: "J" });
    expect(currentTime).toBe(50);
  });

  it("does not skip when L or J is pressed inside an input field", () => {
    const { container } = renderWithToast(<PlaylistDetailClient
        playlist={{
          ...playlist,
          sources: playlist.sources.map((source) => ({
            ...source,
            preferredLinkType: "m3u8" as const,
          })),
        }}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 1 }}
      />,
    );

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    if (!video) return;

    let currentTime = 50;
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      get: () => currentTime,
      set: (val) => {
        currentTime = val;
      },
    });

    // Create a mock input and dispatch keydown on it
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    fireEvent.keyDown(input, { code: "KeyL", key: "L", bubbles: true });
    expect(currentTime).toBe(50); // should not change

    fireEvent.keyDown(input, { code: "KeyJ", key: "J", bubbles: true });
    expect(currentTime).toBe(50); // should not change

    document.body.removeChild(input);
  });

  it("skips forward 30 seconds on right arrow and backward 30 seconds on left arrow", () => {
    const { container } = renderWithToast(<PlaylistDetailClient
        playlist={{
          ...playlist,
          sources: playlist.sources.map((source) => ({
            ...source,
            preferredLinkType: "m3u8" as const,
          })),
        }}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 1 }}
      />,
    );

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    if (!video) return;

    let currentTime = 50;
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      get: () => currentTime,
      set: (val) => {
        currentTime = val;
      },
    });
    Object.defineProperty(video, "duration", {
      configurable: true,
      value: 100,
    });

    fireEvent.keyDown(window, { code: "ArrowRight", key: "ArrowRight" });
    expect(currentTime).toBe(80);

    fireEvent.keyDown(window, { code: "ArrowLeft", key: "ArrowLeft" });
    expect(currentTime).toBe(50);
  });

  it("adjusts volume by 20 percent on up and down arrow keys", () => {
    const { container } = renderWithToast(<PlaylistDetailClient
        playlist={{
          ...playlist,
          sources: playlist.sources.map((source) => ({
            ...source,
            preferredLinkType: "m3u8" as const,
          })),
        }}
        initialPlayback={{ sourceId: "source-a", episodeIndex: 1 }}
      />,
    );

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    if (!video) return;

    Object.defineProperty(video, "volume", {
      configurable: true,
      value: 0.5,
      writable: true,
    });
    Object.defineProperty(video, "muted", {
      configurable: true,
      value: false,
      writable: true,
    });

    fireEvent.keyDown(window, { code: "ArrowUp", key: "ArrowUp" });
    expect(video.volume).toBeCloseTo(0.7);

    fireEvent.keyDown(window, { code: "ArrowDown", key: "ArrowDown" });
    expect(video.volume).toBeCloseTo(0.5);
  });
});
