import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlaylistHomeClient } from "./playlist-home-client";

const refreshMock = vi.fn();
const {
  createPlaylistFromImportedJsonMock,
  createPlaylistFromUrlMock,
  fetchImportPayloadInBrowserMock,
  softDeletePlaylistMock,
  toggleAutoRefreshPlaylistMock,
  togglePinPlaylistMock,
} = vi.hoisted(() => ({
  createPlaylistFromImportedJsonMock: vi.fn(),
  createPlaylistFromUrlMock: vi.fn(),
  fetchImportPayloadInBrowserMock: vi.fn(),
  softDeletePlaylistMock: vi.fn(),
  toggleAutoRefreshPlaylistMock: vi.fn(),
  togglePinPlaylistMock: vi.fn(),
}));

vi.mock("@/actions/import", () => ({
  createPlaylistFromImportedJson: createPlaylistFromImportedJsonMock,
  createPlaylistFromUrl: createPlaylistFromUrlMock,
}));

vi.mock("@/lib/importers", () => ({
  fetchImportPayloadInBrowser: fetchImportPayloadInBrowserMock,
  isNguoncUrl: (url: string) => url.includes("nguonc"),
}));

vi.mock("@/actions/playlists", () => ({
  softDeletePlaylist: softDeletePlaylistMock,
  toggleAutoRefreshPlaylist: toggleAutoRefreshPlaylistMock,
  togglePinPlaylist: togglePinPlaylistMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

vi.mock("@/components/admin/admin-unlock-modal", () => ({
  AdminUnlockModal: ({
    open,
    onClose,
    onUnlocked,
  }: {
    open: boolean;
    onClose: () => void;
    onUnlocked: () => void;
  }) =>
    open ? (
      <div role="dialog">
        <button
          type="button"
          onClick={() => {
            localStorage.setItem("adminSecret", "top-secret");
            onUnlocked();
            onClose();
          }}
        >
          Confirm unlock
        </button>
      </div>
    ) : null,
}));

const playlists = [
  {
    id: "playlist-1",
    title: "Fate Chooses You",
    sourceTitles: ["Vietsub"],
    metadataText: "romance",
    pinned: false,
    pinnedOrder: 0,
    version: 3,
    autoRefreshDisabled: false,
    lastPlayedAt: null,
    updatedAt: "2026-05-09T08:15:00.000Z",
    activeSourceTitle: null,
    activeSourceLastPlayedEpisodeIndex: 0,
    activeSourceTotalEpisodes: 0,
    allSources: [{ title: "Vietsub", totalEpisodes: 0 }],
    refreshSources: [
      {
        id: "source-1",
        sourceUrl: "https://ophim1.com/v1/api/phim/fate-chooses-you",
      },
    ],
    banner: {
      type: "gradient" as const,
      value: "linear-gradient(135deg, #14532d, #1d4ed8)",
      initials: "FC",
    },
  },
  {
    id: "playlist-2",
    title: "Pinned Show",
    sourceTitles: ["Engsub"],
    metadataText: "action",
    pinned: true,
    pinnedOrder: 1,
    version: 2,
    autoRefreshDisabled: false,
    lastPlayedAt: "2026-05-08T10:00:00.000Z",
    updatedAt: "2026-05-08T10:00:00.000Z",
    activeSourceTitle: "Engsub",
    activeSourceLastPlayedEpisodeIndex: 1,
    activeSourceTotalEpisodes: 24,
    allSources: [{ title: "Engsub", totalEpisodes: 24 }],
    refreshSources: [
      {
        id: "source-2",
        sourceUrl: "https://ophim1.com/v1/api/phim/pinned-show",
      },
    ],
    banner: {
      type: "gradient" as const,
      value: "linear-gradient(135deg, #7f1d1d, #b45309)",
      initials: "PS",
    },
  },
];

describe("PlaylistHomeClient", () => {
  beforeEach(() => {
    localStorage.clear();
    refreshMock.mockReset();
    createPlaylistFromImportedJsonMock.mockReset();
    createPlaylistFromUrlMock.mockReset();
    fetchImportPayloadInBrowserMock.mockReset();
    softDeletePlaylistMock.mockReset();
    toggleAutoRefreshPlaylistMock.mockReset();
    createPlaylistFromImportedJsonMock.mockResolvedValue({
      ok: true,
      data: {
        playlistId: "playlist-2",
        message: "Imported playlist",
      },
    });
    createPlaylistFromUrlMock.mockResolvedValue({
      ok: true,
      data: {
        playlistId: "playlist-2",
        message: "Imported playlist",
      },
    });
    fetchImportPayloadInBrowserMock.mockResolvedValue({
      sourceUrl: "https://phim.nguonc.com/api/film/huyen-thoai-linh-bep",
      importedJson: {
        status: "success",
      },
    });
    softDeletePlaylistMock.mockResolvedValue({
      ok: true,
      data: undefined,
    });
    togglePinPlaylistMock.mockResolvedValue({
      ok: true,
      data: undefined,
    });
    toggleAutoRefreshPlaylistMock.mockResolvedValue({
      ok: true,
      data: undefined,
    });
  });

  it("shows admin unlock and hides the import form while locked", () => {
    render(<PlaylistHomeClient playlists={playlists} />);

    expect(
      screen.getByRole("button", { name: "Admin Unlock" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add playlist" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Playlist source URL")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Search playlists")).toBeInTheDocument();
  });

  it("shows the import field when a stored secret exists", async () => {
    localStorage.setItem("adminSecret", "top-secret");

    render(<PlaylistHomeClient playlists={playlists} />);

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Admin Unlock" }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByLabelText("Playlist source URL")).toBeVisible();
    expect(screen.getByRole("button", { name: "Add playlist" })).toBeDisabled();
  });

  it("shows the import field after unlocking from the toolbar", async () => {
    render(<PlaylistHomeClient playlists={playlists} />);

    fireEvent.click(screen.getByRole("button", { name: "Admin Unlock" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm unlock" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Admin Unlock" }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByLabelText("Playlist source URL")).toBeVisible();
  });

  it("submits a new playlist URL from the inline toolbar form", async () => {
    localStorage.setItem("adminSecret", "top-secret");

    render(<PlaylistHomeClient playlists={playlists} />);

    const sourceInput = await screen.findByLabelText("Playlist source URL");
    fireEvent.change(sourceInput, {
      target: {
        value: "https://ophim1.com/v1/api/phim/fate-chooses-you",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add playlist" }));

    await waitFor(() => {
      expect(createPlaylistFromUrlMock).toHaveBeenCalledWith({
        adminSecret: "top-secret",
        sourceUrl: "https://ophim1.com/v1/api/phim/fate-chooses-you",
      });
      expect(sourceInput).toHaveValue("");
    });

    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(sourceInput).toBeVisible();
  });

  it("ignores a second paste while the import request is in flight", async () => {
    localStorage.setItem("adminSecret", "top-secret");

    render(<PlaylistHomeClient playlists={playlists} />);

    const sourceInput = await screen.findByLabelText("Playlist source URL");
    fireEvent.paste(sourceInput, {
      clipboardData: {
        getData: () => "https://ophim1.com/v1/api/phim/fate-chooses-you",
      },
    });
    fireEvent.paste(sourceInput, {
      clipboardData: {
        getData: () => "https://ophim1.com/v1/api/phim/pinned-show",
      },
    });

    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });

    expect(createPlaylistFromUrlMock).toHaveBeenCalledTimes(1);
    expect(createPlaylistFromUrlMock).toHaveBeenCalledWith({
      adminSecret: "top-secret",
      sourceUrl: "https://ophim1.com/v1/api/phim/fate-chooses-you",
    });
  });

  it("fetches NguonC imports in the browser and sends the payload to the server action", async () => {
    localStorage.setItem("adminSecret", "top-secret");
    createPlaylistFromUrlMock.mockResolvedValueOnce({
      ok: false,
      error: "Import request failed with 403",
    });

    render(<PlaylistHomeClient playlists={playlists} />);

    const sourceInput = await screen.findByLabelText("Playlist source URL");
    fireEvent.paste(sourceInput, {
      clipboardData: {
        getData: () => " https://phim.nguonc.com/phim/huyen-thoai-linh-bep \n",
      },
    });

    await waitFor(() => {
      expect(createPlaylistFromUrlMock).toHaveBeenCalledWith({
        adminSecret: "top-secret",
        sourceUrl: "https://phim.nguonc.com/phim/huyen-thoai-linh-bep",
      });
      expect(fetchImportPayloadInBrowserMock).toHaveBeenCalledWith(
        "https://phim.nguonc.com/phim/huyen-thoai-linh-bep",
      );
      expect(createPlaylistFromImportedJsonMock).toHaveBeenCalledWith({
        adminSecret: "top-secret",
        sourceUrl: "https://phim.nguonc.com/api/film/huyen-thoai-linh-bep",
        importedJson: {
          status: "success",
        },
      });
    });

    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("does not use browser fallback when server import succeeds for NguonC", async () => {
    localStorage.setItem("adminSecret", "top-secret");

    render(<PlaylistHomeClient playlists={playlists} />);

    const sourceInput = await screen.findByLabelText("Playlist source URL");
    fireEvent.change(sourceInput, {
      target: {
        value: "https://phim.nguonc.com/phim/huyen-thoai-linh-bep",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add playlist" }));

    await waitFor(() => {
      expect(createPlaylistFromUrlMock).toHaveBeenCalledWith({
        adminSecret: "top-secret",
        sourceUrl: "https://phim.nguonc.com/phim/huyen-thoai-linh-bep",
      });
    });

    expect(fetchImportPayloadInBrowserMock).not.toHaveBeenCalled();
    expect(createPlaylistFromImportedJsonMock).not.toHaveBeenCalled();
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("does not import a pasted value unless it is a valid HTTP or HTTPS URL", async () => {
    localStorage.setItem("adminSecret", "top-secret");

    render(<PlaylistHomeClient playlists={playlists} />);

    const sourceInput = await screen.findByLabelText("Playlist source URL");
    fireEvent.paste(sourceInput, {
      clipboardData: { getData: () => "ftp://example.com/playlist.json" },
    });
    fireEvent.paste(sourceInput, {
      clipboardData: { getData: () => "https://[invalid" },
    });
    expect(createPlaylistFromUrlMock).not.toHaveBeenCalled();
  });

  it("shows a delete action on right click and deletes the playlist without confirmation", async () => {
    localStorage.setItem("adminSecret", "top-secret");

    render(<PlaylistHomeClient playlists={playlists} />);

    fireEvent.contextMenu(
      screen.getByRole("link", { name: /fate chooses you/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(softDeletePlaylistMock).toHaveBeenCalledWith({
        adminSecret: "top-secret",
        playlistId: "playlist-1",
        version: 3,
      });
    });

    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("shows pinned playlists in a separate section above unpinned playlists", () => {
    render(<PlaylistHomeClient playlists={playlists} />);

    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings[0]).toHaveTextContent("Pinned");
    expect(headings[1]).toHaveTextContent("All playlists");

    expect(
      screen.getByRole("link", { name: /pinned show/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /fate chooses you/i }),
    ).toBeInTheDocument();
  });

  it("shows a pin action on right click and pins the playlist", async () => {
    localStorage.setItem("adminSecret", "top-secret");

    render(<PlaylistHomeClient playlists={playlists} />);

    fireEvent.contextMenu(
      screen.getByRole("link", { name: /fate chooses you/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Pin" }));

    await waitFor(() => {
      expect(togglePinPlaylistMock).toHaveBeenCalledWith({
        adminSecret: "top-secret",
        playlistId: "playlist-1",
        version: 3,
        pinned: true,
      });
    });

    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("shows a disable-refresh action on right click and disables auto-refresh", async () => {
    localStorage.setItem("adminSecret", "top-secret");

    render(<PlaylistHomeClient playlists={playlists} />);

    fireEvent.contextMenu(
      screen.getByRole("link", { name: /fate chooses you/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Disable Refresh" }));

    await waitFor(() => {
      expect(toggleAutoRefreshPlaylistMock).toHaveBeenCalledWith({
        adminSecret: "top-secret",
        playlistId: "playlist-1",
        version: 3,
        autoRefreshDisabled: true,
      });
    });

    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("shows an enable-refresh action for playlists with auto-refresh disabled", async () => {
    localStorage.setItem("adminSecret", "top-secret");

    const disabledPlaylists = playlists.map((p) =>
      p.id === "playlist-1" ? { ...p, autoRefreshDisabled: true } : p,
    );

    render(<PlaylistHomeClient playlists={disabledPlaylists} />);

    fireEvent.contextMenu(
      screen.getByRole("link", { name: /fate chooses you/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Enable Refresh" }));

    await waitFor(() => {
      expect(toggleAutoRefreshPlaylistMock).toHaveBeenCalledWith({
        adminSecret: "top-secret",
        playlistId: "playlist-1",
        version: 3,
        autoRefreshDisabled: false,
      });
    });

    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("shows an unpin action for already pinned playlists", async () => {
    localStorage.setItem("adminSecret", "top-secret");

    render(<PlaylistHomeClient playlists={playlists} />);

    fireEvent.contextMenu(screen.getByRole("link", { name: /pinned show/i }));
    fireEvent.click(screen.getByRole("button", { name: "Unpin" }));

    await waitFor(() => {
      expect(togglePinPlaylistMock).toHaveBeenCalledWith({
        adminSecret: "top-secret",
        playlistId: "playlist-2",
        version: 2,
        pinned: false,
      });
    });

    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});
