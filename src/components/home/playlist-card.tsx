"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { refreshPlaylistSources } from "@/actions/import";
import {
  softDeletePlaylist,
  toggleAutoRefreshPlaylist,
  togglePinPlaylist,
} from "@/actions/playlists";
import type { PlaylistSummary } from "@/db/queries/home";

export function PlaylistCard({ playlist }: { playlist: PlaylistSummary }) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPinning, setIsPinning] = useState(false);
  const [isRefreshingSources, setIsRefreshingSources] = useState(false);
  const [isTogglingRefresh, setIsTogglingRefresh] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  async function handleDeleteClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    const adminSecret = localStorage.getItem("adminSecret");
    if (!adminSecret) {
      throw new Error("Admin unlock required");
    }

    setIsDeleting(true);

    const result = await softDeletePlaylist({
      adminSecret,
      playlistId: playlist.id,
      version: playlist.version,
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    setMenuOpen(false);
    router.refresh();
  }

  async function handleRefreshSourcesClick(
    event: React.MouseEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    const adminSecret = localStorage.getItem("adminSecret");
    if (!adminSecret) {
      setToast("Admin unlock required");
      setMenuOpen(false);
      return;
    }

    setIsRefreshingSources(true);
    setToast(null);

    try {
      const result = await refreshPlaylistSources({
        adminSecret,
        playlistId: playlist.id,
      });

      setToast(result.ok ? result.data.message : result.error);
      router.refresh();
    } catch (error) {
      setToast(
        error instanceof Error && error.message.trim()
          ? error.message
          : "Refresh failed",
      );
    } finally {
      setIsRefreshingSources(false);
      setMenuOpen(false);
    }
  }

  async function handleAutoRefreshClick(
    event: React.MouseEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    const adminSecret = localStorage.getItem("adminSecret");
    if (!adminSecret) {
      throw new Error("Admin unlock required");
    }

    setIsTogglingRefresh(true);

    const result = await toggleAutoRefreshPlaylist({
      adminSecret,
      playlistId: playlist.id,
      version: playlist.version,
      autoRefreshDisabled: !playlist.autoRefreshDisabled,
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    setIsTogglingRefresh(false);
    setMenuOpen(false);
    router.refresh();
  }

  async function handlePinClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    const adminSecret = localStorage.getItem("adminSecret");
    if (!adminSecret) {
      throw new Error("Admin unlock required");
    }

    setIsPinning(true);

    const result = await togglePinPlaylist({
      adminSecret,
      playlistId: playlist.id,
      version: playlist.version,
      pinned: !playlist.pinned,
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    setIsPinning(false);
    setMenuOpen(false);
    router.refresh();
  }

  return (
    <div
      ref={menuRef}
      className="playlist-card-shell"
      onContextMenu={(event) => {
        event.preventDefault();
        setMenuOpen(true);
      }}
    >
      <Link href={`/playlist/${playlist.id}`} className="playlist-card">
        <div
          className={`playlist-card-banner playlist-card-banner-${playlist.banner.type}`}
          style={
            playlist.banner.type === "image"
              ? { backgroundImage: `url(${playlist.banner.value})` }
              : { backgroundImage: playlist.banner.value }
          }
        >
          {playlist.banner.type === "gradient" ? (
            <span className="playlist-card-initials">
              {playlist.banner.initials}
            </span>
          ) : null}
        </div>
        <div className="playlist-card-body">
          <div className="playlist-card-heading">
            <h2>{playlist.title}</h2>
          </div>
          <div className="playlist-card-sources">
            {playlist.activeSourceTotalEpisodes > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      background: "rgba(255, 255, 255, 0.12)",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      color: "#fff",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      letterSpacing: "0.05em",
                    }}
                  >
                    EP {playlist.activeSourceLastPlayedEpisodeIndex + 1}
                  </span>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {playlist.allSources.map((s, i) => {
                    const isActive = s.title === playlist.activeSourceTitle;
                    return (
                      <span
                        key={i}
                        style={{
                          fontSize: "0.75rem",
                          padding: "2px 8px",
                          borderRadius: "999px",
                          background: isActive
                            ? "rgba(59, 130, 246, 0.15)"
                            : "rgba(20, 166, 25, 0.1)",
                          color: isActive ? "#93c5fd" : "#46a346ff",
                          border: `1px solid ${
                            isActive
                              ? "rgba(59, 130, 246, 0.3)"
                              : "rgba(20, 166, 25, 0.3)"
                          }`,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                        }}
                      >
                        <span>{s.title}</span>
                        <strong
                          style={{
                            color: isActive ? "#ffffff" : "#d4d4d4",
                            fontWeight: 600,
                          }}
                        >
                          {s.totalEpisodes}
                        </strong>
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </Link>
      {menuOpen ? (
        <div
          className="playlist-card-menu"
          role="menu"
          aria-label={`${playlist.title} actions`}
        >
          <button
            type="button"
            className="playlist-card-menu-refresh"
            onClick={handleRefreshSourcesClick}
            disabled={isRefreshingSources}
          >
            {isRefreshingSources ? "Refreshing..." : "Refresh Sources"}
          </button>
          <button
            type="button"
            className="playlist-card-menu-autorefresh"
            onClick={handleAutoRefreshClick}
            disabled={isTogglingRefresh}
          >
            {isTogglingRefresh
              ? playlist.autoRefreshDisabled
                ? "Enabling..."
                : "Disabling..."
              : playlist.autoRefreshDisabled
                ? "Enable Refresh"
                : "Disable Refresh"}
          </button>
          <button
            type="button"
            className="playlist-card-menu-pin"
            onClick={handlePinClick}
            disabled={isPinning}
          >
            {isPinning
              ? playlist.pinned
                ? "Unpinning..."
                : "Pinning..."
              : playlist.pinned
                ? "Unpin"
                : "Pin"}
          </button>
          <button
            type="button"
            className="playlist-card-menu-delete"
            onClick={handleDeleteClick}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      ) : null}
      {toast ? (
        <div className="playlist-card-toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
