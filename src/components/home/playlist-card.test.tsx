import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearAppToast } from "@/lib/app-toast";
import { AppToastHost } from "@/components/playlist/toast";
import { PlaylistCard } from "./playlist-card";

function renderWithToast(ui: React.ReactElement) {
  return render(
    <>
      <AppToastHost />
      {ui}
    </>,
  );
}

const refreshMock = vi.fn();
const {
  fetchImportPayloadInBrowserMock,
  refreshPlaylistSourcesFromImportedJsonMock,
} = vi.hoisted(() => ({
  fetchImportPayloadInBrowserMock: vi.fn(),
  refreshPlaylistSourcesFromImportedJsonMock: vi.fn(),
}));

vi.mock("@/actions/import", () => ({
  refreshPlaylistSourcesFromImportedJson:
    refreshPlaylistSourcesFromImportedJsonMock,
}));

vi.mock("@/lib/importers", () => ({
  fetchImportPayloadInBrowser: fetchImportPayloadInBrowserMock,
}));

vi.mock("@/actions/playlists", () => ({
  softDeletePlaylist: vi.fn(),
  togglePinPlaylist: vi.fn(),
  toggleAutoRefreshPlaylist: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

beforeEach(() => {
  localStorage.clear();
  refreshMock.mockReset();
  fetchImportPayloadInBrowserMock.mockReset();
  refreshPlaylistSourcesFromImportedJsonMock.mockReset();
  fetchImportPayloadInBrowserMock.mockResolvedValue({
    sourceUrl: "https://video.test/source-a.json",
    importedJson: {
      status: "success",
    },
  });
  refreshPlaylistSourcesFromImportedJsonMock.mockResolvedValue({
    ok: true,
    data: {
      message: "Refreshed 1 source.",
      refreshedCount: 1,
      failedCount: 0,
    },
  });
});

afterEach(() => {
  act(() => {
    clearAppToast();
  });
});

it("renders the active episode progress", () => {
  render(
    <PlaylistCard
      playlist={{
        id: "playlist-1",
        title: "Fate Chooses You",
        sourceTitles: ["Vietsub"],
        metadataText: "romance",
        pinned: false,
        pinnedOrder: 0,
        version: 1,
        autoRefreshDisabled: false,
        lastPlayedAt: "2026-05-01T23:30:00.000-05:00",
        updatedAt: "2026-05-09T08:15:00.000Z",
        activeSourceTitle: "Vietsub",
        activeSourceLastPlayedEpisodeIndex: 2,
        activeSourceTotalEpisodes: 12,
        allSources: [{ title: "Vietsub", totalEpisodes: 12 }],
        refreshSources: [
          {
            id: "source-a",
            sourceUrl: "https://video.test/source-a.json",
          },
        ],
        banner: {
          type: "gradient",
          value: "linear-gradient(135deg, #14532d, #1d4ed8)",
          initials: "FC",
        },
      }}
    />,
  );

  expect(screen.getByText("EP 3")).toBeInTheDocument();
  expect(screen.getByText("Vietsub")).toBeInTheDocument();
});

it("fetches source payloads in the browser and persists them when refreshing", async () => {
  localStorage.setItem("adminSecret", "top-secret");

  renderWithToast(
    <PlaylistCard
      playlist={{
        id: "playlist-1",
        title: "Fate Chooses You",
        sourceTitles: ["Vietsub"],
        metadataText: "romance",
        pinned: false,
        pinnedOrder: 0,
        version: 1,
        autoRefreshDisabled: false,
        lastPlayedAt: "2026-05-01T23:30:00.000-05:00",
        updatedAt: "2026-05-09T08:15:00.000Z",
        activeSourceTitle: "Vietsub",
        activeSourceLastPlayedEpisodeIndex: 2,
        activeSourceTotalEpisodes: 12,
        allSources: [{ title: "Vietsub", totalEpisodes: 12 }],
        refreshSources: [
          {
            id: "source-a",
            sourceUrl: "https://video.test/source-a.json",
          },
        ],
        banner: {
          type: "gradient",
          value: "linear-gradient(135deg, #14532d, #1d4ed8)",
          initials: "FC",
        },
      }}
    />,
  );

  fireEvent.contextMenu(
    screen.getByRole("link", { name: /fate chooses you/i }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Refresh Sources" }));

  await waitFor(() => {
    expect(fetchImportPayloadInBrowserMock).toHaveBeenCalledWith(
      "https://video.test/source-a.json",
    );
  });

  expect(refreshPlaylistSourcesFromImportedJsonMock).toHaveBeenCalledWith({
    adminSecret: "top-secret",
    playlistId: "playlist-1",
    refreshes: [
      {
        sourceId: "source-a",
        sourceUrl: "https://video.test/source-a.json",
        importedJson: {
          status: "success",
        },
      },
    ],
  });
  expect(refreshMock).toHaveBeenCalledTimes(1);
  const toast = screen.getByRole("status");
  expect(toast).toHaveTextContent("Refreshed 1 source.");
  expect(toast.className).toContain("app-corner-toast");
  expect(toast.parentElement).toBe(document.body);
});

it("logs refresh errors to the console when the server refresh fails", async () => {
  localStorage.setItem("adminSecret", "top-secret");
  refreshPlaylistSourcesFromImportedJsonMock.mockResolvedValueOnce({
    ok: false,
    error: "Refresh failed upstream",
  });
  const consoleErrorSpy = vi
    .spyOn(console, "error")
    .mockImplementation(() => {});

  renderWithToast(
    <PlaylistCard
      playlist={{
        id: "playlist-1",
        title: "Fate Chooses You",
        sourceTitles: ["Vietsub"],
        metadataText: "romance",
        pinned: false,
        pinnedOrder: 0,
        version: 1,
        autoRefreshDisabled: false,
        lastPlayedAt: "2026-05-01T23:30:00.000-05:00",
        updatedAt: "2026-05-09T08:15:00.000Z",
        activeSourceTitle: "Vietsub",
        activeSourceLastPlayedEpisodeIndex: 2,
        activeSourceTotalEpisodes: 12,
        allSources: [{ title: "Vietsub", totalEpisodes: 12 }],
        refreshSources: [
          {
            id: "source-a",
            sourceUrl: "https://video.test/source-a.json",
          },
        ],
        banner: {
          type: "gradient",
          value: "linear-gradient(135deg, #14532d, #1d4ed8)",
          initials: "FC",
        },
      }}
    />,
  );

  fireEvent.contextMenu(
    screen.getByRole("link", { name: /fate chooses you/i }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Refresh Sources" }));

  await waitFor(() => {
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[PlaylistCard] refresh failed:",
      "Refresh failed upstream",
    );
  });

  const toast = screen.getByRole("status");
  expect(toast).toHaveTextContent("Refresh failed upstream");
  expect(toast.className).toContain("app-corner-toast");
  expect(toast.parentElement).toBe(document.body);
  consoleErrorSpy.mockRestore();
});
