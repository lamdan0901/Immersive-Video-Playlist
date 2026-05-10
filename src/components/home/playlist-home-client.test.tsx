import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlaylistHomeClient } from "./playlist-home-client";

const refreshMock = vi.fn();
const { createPlaylistFromUrlMock, softDeletePlaylistMock } = vi.hoisted(() => ({
  createPlaylistFromUrlMock: vi.fn(),
  softDeletePlaylistMock: vi.fn()
}));

vi.mock("@/actions/import", () => ({
  createPlaylistFromUrl: createPlaylistFromUrlMock
}));

vi.mock("@/actions/playlists", () => ({
  softDeletePlaylist: softDeletePlaylistMock
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock
  })
}));

vi.mock("@/components/admin/admin-unlock-modal", () => ({
  AdminUnlockModal: ({ open, onClose, onUnlocked }: { open: boolean; onClose: () => void; onUnlocked: () => void }) =>
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
    ) : null
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
    lastPlayedAt: null,
    updatedAt: "2026-05-09T08:15:00.000Z",
    banner: {
      type: "gradient" as const,
      value: "linear-gradient(135deg, #14532d, #1d4ed8)",
      initials: "FC"
    }
  }
];

describe("PlaylistHomeClient", () => {
  beforeEach(() => {
    localStorage.clear();
    refreshMock.mockReset();
    createPlaylistFromUrlMock.mockReset();
    softDeletePlaylistMock.mockReset();
    createPlaylistFromUrlMock.mockResolvedValue({
      ok: true,
      data: {
        playlistId: "playlist-2",
        message: "Imported playlist"
      }
    });
    softDeletePlaylistMock.mockResolvedValue({
      ok: true,
      data: undefined
    });
  });

  it("shows a disabled add playlist button while locked", () => {
    render(<PlaylistHomeClient playlists={playlists} />);

    expect(screen.getByRole("button", { name: "Unlock" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add playlist" })).toBeDisabled();
  });

  it("hides unlock and enables add playlist when a stored secret exists", async () => {
    localStorage.setItem("adminSecret", "top-secret");

    render(<PlaylistHomeClient playlists={playlists} />);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Unlock" })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Add playlist" })).toBeEnabled();
  });

  it("enables add playlist after unlocking from the toolbar", async () => {
    render(<PlaylistHomeClient playlists={playlists} />);

    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm unlock" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Unlock" })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Add playlist" })).toBeEnabled();
  });

  it("submits a new playlist URL from the inline toolbar form", async () => {
    localStorage.setItem("adminSecret", "top-secret");

    render(<PlaylistHomeClient playlists={playlists} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add playlist" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Add playlist" }));
    fireEvent.change(screen.getByLabelText("Playlist source URL"), {
      target: {
        value: "https://ophim1.com/v1/api/phim/fate-chooses-you"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Import playlist" }));

    await waitFor(() => {
      expect(createPlaylistFromUrlMock).toHaveBeenCalledWith({
        adminSecret: "top-secret",
        sourceUrl: "https://ophim1.com/v1/api/phim/fate-chooses-you"
      });
    });

    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Playlist source URL")).not.toBeInTheDocument();
  });

  it("autofocuses the playlist source URL input when the inline form opens", async () => {
    localStorage.setItem("adminSecret", "top-secret");

    render(<PlaylistHomeClient playlists={playlists} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add playlist" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Add playlist" }));

    expect(screen.getByLabelText("Playlist source URL")).toHaveFocus();
  });

  it("shows a delete action on right click and deletes the playlist without confirmation", async () => {
    localStorage.setItem("adminSecret", "top-secret");

    render(<PlaylistHomeClient playlists={playlists} />);

    fireEvent.contextMenu(screen.getByRole("link", { name: /fate chooses you/i }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(softDeletePlaylistMock).toHaveBeenCalledWith({
        adminSecret: "top-secret",
        playlistId: "playlist-1",
        version: 3
      });
    });

    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});
