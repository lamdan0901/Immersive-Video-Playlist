"use client";

import { Folder } from "lucide-react";
import { useCachedImage } from "@/lib/use-cached-image";
import type { PlaylistGroupEntry } from "./playlist-library";

function PlaylistGroupCover({ banner }: { banner: PlaylistGroupEntry["playlists"][number]["banner"] }) {
  const imageUrl = useCachedImage(banner.type === "image" ? banner.value : null);

  return (
    <span
      className="playlist-group-cover"
      style={{ backgroundImage: banner.type === "image" ? `url(${imageUrl ?? banner.value})` : banner.value }}
    >
      {banner.type === "gradient" ? <span className="playlist-card-initials">{banner.initials}</span> : null}
    </span>
  );
}

export function PlaylistGroupCard({ entry, onOpen }: { entry: PlaylistGroupEntry; onOpen: () => void }) {
  const count = entry.playlists.length;
  const covers = entry.playlists.slice(0, 4);

  return (
    <button type="button" className="playlist-card playlist-group-card" aria-haspopup="dialog" onClick={onOpen}>
      <span className="playlist-card-banner playlist-group-banner" data-cover-count={covers.length} aria-hidden="true">
        {covers.map((playlist) => <PlaylistGroupCover key={playlist.id} banner={playlist.banner} />)}
        <span className="playlist-group-icon"><Folder size={18} /></span>
      </span>
      <span className="playlist-card-body">
        <span className="playlist-group-title">{entry.title}</span>
        <span className="playlist-card-meta">{count} {count === 1 ? "playlist" : "playlists"}</span>
      </span>
    </button>
  );
}
