"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPlaylistFromUrl } from "@/actions/import";
import type { PlaylistSummary } from "@/db/queries/home";
import { rankPlaylists } from "@/lib/relevance";
import { AdminUnlockModal } from "@/components/admin/admin-unlock-modal";
import { PlaylistCard } from "./playlist-card";

export function PlaylistHomeClient({ playlists }: { playlists: PlaylistSummary[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const ranked = rankPlaylists(playlists, query);

  useEffect(() => {
    setIsUnlocked(Boolean(localStorage.getItem("adminSecret")));
  }, []);

  async function handleCreatePlaylist(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const adminSecret = localStorage.getItem("adminSecret");
    if (!adminSecret) {
      setSubmitError("Admin unlock required");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    const result = await createPlaylistFromUrl({
      adminSecret,
      sourceUrl: sourceUrl.trim()
    });

    if (!result.ok) {
      setSubmitError(result.error);
      setIsSubmitting(false);
      return;
    }

    setSourceUrl("");
    setShowAddForm(false);
    setIsSubmitting(false);
    router.refresh();
  }

  function handleUnlocked() {
    setIsUnlocked(true);
  }

  function handleCancelAdd() {
    setSourceUrl("");
    setSubmitError("");
    setShowAddForm(false);
  }

  return (
    <>
      <header className="home-toolbar">
        <div className="home-toolbar-copy">
          <h1>Immersive Video Playlist</h1>
          <p>Resume recent watches, jump into pinned series, and search by title or source.</p>
        </div>
        <div className="home-toolbar-controls">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search playlists" aria-label="Search playlists" />
          <button
            type="button"
            className="accent-button"
            disabled={!isUnlocked}
            onClick={() => {
              setShowAddForm(true);
              setSubmitError("");
            }}
          >
            Add playlist
          </button>
          {!isUnlocked ? <button type="button" className="accent-button" onClick={() => setUnlockOpen(true)}>Unlock</button> : null}
        </div>
        {showAddForm ? (
          <form className="home-import-panel" onSubmit={handleCreatePlaylist}>
            <div className="home-import-panel-copy">
              <p className="home-import-panel-eyebrow">Quick import</p>
              <h2>Import a playlist from a JSON source</h2>
              <p>Paste a direct playlist JSON URL. The app will create the playlist and pull in its episodes.</p>
            </div>
            <label className="home-import-field">
              <span>Playlist source URL</span>
              <div className="home-import-input-shell">
                <span className="home-import-input-icon" aria-hidden="true">
                  link
                </span>
                <input
                  aria-label="Playlist source URL"
                  autoFocus
                  placeholder="https://ophim1.com/v1/api/phim/fate-chooses-you"
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                />
              </div>
            </label>
            <div className="home-import-actions">
              <button type="submit" className="accent-button" disabled={isSubmitting || !sourceUrl.trim()}>
                {isSubmitting ? "Importing..." : "Import playlist"}
              </button>
              <button type="button" className="ghost-button" disabled={isSubmitting} onClick={handleCancelAdd}>
                Cancel
              </button>
            </div>
            {submitError ? <p className="home-toolbar-inline-error">{submitError}</p> : null}
          </form>
        ) : null}
      </header>
      <section className="playlist-grid">
        {ranked.map((playlist) => <PlaylistCard key={playlist.id} playlist={playlist} />)}
      </section>
      {!ranked.length ? <p className="playlist-empty">No playlists match that search.</p> : null}
      <AdminUnlockModal open={unlockOpen} onClose={() => setUnlockOpen(false)} onUnlocked={handleUnlocked} />
    </>
  );
}
