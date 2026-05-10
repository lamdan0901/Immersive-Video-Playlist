"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { softDeletePlaylist } from "@/actions/playlists";
import type { PlaylistSummary } from "@/db/queries/home";

function formatUtcDate(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function formatTime(value: string | null) {
  if (!value) return "Never played";
  return `Last played ${formatUtcDate(value)}`;
}

export function PlaylistCard({ playlist }: { playlist: PlaylistSummary }) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
      version: playlist.version
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

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
          style={playlist.banner.type === "image" ? { backgroundImage: `url(${playlist.banner.value})` } : { backgroundImage: playlist.banner.value }}
        >
          {playlist.banner.type === "gradient" ? <span className="playlist-card-initials">{playlist.banner.initials}</span> : null}
        </div>
        <div className="playlist-card-body">
          <div className="playlist-card-heading">
            <h2>{playlist.title}</h2>
            {playlist.pinned ? <span className="playlist-card-pin">Pinned</span> : null}
          </div>
          <p className="playlist-card-sources">{playlist.sourceTitles.join(" · ") || "No sources yet"}</p>
          <p className="playlist-card-meta">
            <span>{formatTime(playlist.lastPlayedAt)}</span>
            <span>Updated {formatUtcDate(playlist.updatedAt)}</span>
          </p>
        </div>
      </Link>
      {menuOpen ? (
        <div className="playlist-card-menu" role="menu" aria-label={`${playlist.title} actions`}>
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
    </div>
  );
}
