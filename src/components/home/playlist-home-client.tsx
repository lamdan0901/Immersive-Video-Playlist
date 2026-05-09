"use client";

import { useState } from "react";
import type { PlaylistSummary } from "@/db/queries/home";
import { rankPlaylists } from "@/lib/relevance";
import { AdminUnlockModal } from "@/components/admin/admin-unlock-modal";
import { PlaylistCard } from "./playlist-card";

export function PlaylistHomeClient({ playlists }: { playlists: PlaylistSummary[] }) {
  const [query, setQuery] = useState("");
  const [unlockOpen, setUnlockOpen] = useState(false);
  const ranked = rankPlaylists(playlists, query);

  return (
    <>
      <header className="home-toolbar">
        <div className="home-toolbar-copy">
          <h1>Immersive Video Playlist</h1>
          <p>Resume recent watches, jump into pinned series, and search by title or source.</p>
        </div>
        <div className="home-toolbar-controls">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search playlists" aria-label="Search playlists" />
          <button type="button" className="accent-button" onClick={() => setUnlockOpen(true)}>Unlock</button>
        </div>
      </header>
      <section className="playlist-grid">
        {ranked.map((playlist) => <PlaylistCard key={playlist.id} playlist={playlist} />)}
      </section>
      {!ranked.length ? <p className="playlist-empty">No playlists match that search.</p> : null}
      <AdminUnlockModal open={unlockOpen} onClose={() => setUnlockOpen(false)} />
    </>
  );
}
