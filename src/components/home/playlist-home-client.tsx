"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createPlaylistFromImportedJson,
  createPlaylistFromUrl,
} from "@/actions/import";
import type { PlaylistSummary } from "@/db/queries/home";
import { fetchImportPayloadInBrowser, isNguoncUrl } from "@/lib/importers";
import { rankPlaylists } from "@/lib/relevance";
import { AdminUnlockModal } from "@/components/admin/admin-unlock-modal";
import { PlaylistCard } from "./playlist-card";

function isPlaylistSourceUrl(value: string) {
  if (!/^https?:\/\/\S+$/i.test(value)) return false;

  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function PlaylistHomeClient({
  playlists,
}: {
  playlists: PlaylistSummary[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const ranked = rankPlaylists(playlists, query);
  const pinnedPlaylists = ranked.filter((p) => p.pinned);
  const unpinnedPlaylists = ranked.filter((p) => !p.pinned);

  useEffect(() => {
    setIsUnlocked(Boolean(localStorage.getItem("adminSecret")));
  }, []);

  function asErrorMessage(error: unknown) {
    return error instanceof Error && error.message.trim()
      ? error.message
      : "Import failed";
  }

  function isUpstreamImportBlock(errorMessage: string) {
    return /^Import request failed with (403|429)$/.test(errorMessage.trim());
  }

  async function handleCreatePlaylist(trimmedSourceUrl: string) {
    if (submitLockRef.current) {
      return;
    }

    const adminSecret = localStorage.getItem("adminSecret");
    if (!adminSecret) {
      setSubmitError("Admin unlock required");
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    setSubmitError("");

    try {
      let result = await createPlaylistFromUrl({
        adminSecret,
        sourceUrl: trimmedSourceUrl,
      });

      if (
        !result.ok
        && isNguoncUrl(trimmedSourceUrl)
        && isUpstreamImportBlock(result.error)
      ) {
        const payload = await fetchImportPayloadInBrowser(trimmedSourceUrl);
        result = await createPlaylistFromImportedJson({
          adminSecret,
          sourceUrl: payload.sourceUrl,
          importedJson: payload.importedJson,
        });
      }

      if (!result.ok) {
        console.error("[createPlaylistFromUrl] failed:", result.error);
        setSubmitError(result.error);
        return;
      }

      setSourceUrl("");
      router.refresh();
    } catch (error) {
      console.error("[handleCreatePlaylist] failed:", error);
      setSubmitError(asErrorMessage(error));
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = sourceUrl.trim();
    if (!isPlaylistSourceUrl(url)) {
      setSubmitError("Enter a valid HTTP or HTTPS URL.");
      return;
    }

    await handleCreatePlaylist(url);
  }

  async function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const url = event.clipboardData.getData("text/plain").trim();
    if (!isPlaylistSourceUrl(url)) return;

    event.preventDefault();
    if (submitLockRef.current) return;

    setSourceUrl(url);
    await handleCreatePlaylist(url);
  }

  return (
    <>
      <header className="home-toolbar">
        <div className="home-toolbar-copy">
          <h1>Immersive Video Playlist</h1>
          <p>
            Resume recent watches, jump into pinned series, and search by title
            or source.
          </p>
        </div>
        <div className="home-toolbar-controls">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search playlists"
            aria-label="Search playlists"
          />
          {!isUnlocked ? (
            <button
              type="button"
              className="accent-button"
              onClick={() => setUnlockOpen(true)}
            >
              Admin Unlock
            </button>
          ) : null}
        </div>
        {isUnlocked ? (
          <form className="home-import-form" onSubmit={handleSubmit}>
            <input
              inputMode="url"
              aria-label="Playlist source URL"
              aria-describedby={submitError ? "home-import-error" : undefined}
              placeholder="Paste a playlist link"
              readOnly={isSubmitting}
              value={sourceUrl}
              onChange={(event) => {
                setSourceUrl(event.target.value);
                setSubmitError("");
              }}
              onPaste={handlePaste}
            />
            <button
              type="submit"
              className="accent-button"
              disabled={isSubmitting || !sourceUrl.trim()}
            >
              {isSubmitting ? "Importing..." : "Add playlist"}
            </button>
            {submitError ? (
              <p
                id="home-import-error"
                role="alert"
                className="home-toolbar-inline-error"
              >
                {submitError}
              </p>
            ) : null}
          </form>
        ) : null}
      </header>
      {pinnedPlaylists.length > 0 ? (
        <section>
          <h3 className="playlist-section-heading">Pinned</h3>
          <div className="playlist-grid">
            {pinnedPlaylists.map((playlist) => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))}
          </div>
        </section>
      ) : null}
      {unpinnedPlaylists.length > 0 ? (
        <section>
          {pinnedPlaylists.length > 0 ? (
            <h3 className="playlist-section-heading">All playlists</h3>
          ) : null}
          <div className="playlist-grid">
            {unpinnedPlaylists.map((playlist) => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))}
          </div>
        </section>
      ) : null}
      {!ranked.length ? (
        <p className="playlist-empty">No playlists match that search.</p>
      ) : null}
      <AdminUnlockModal
        open={unlockOpen}
        onClose={() => setUnlockOpen(false)}
        onUnlocked={() => setIsUnlocked(true)}
      />
    </>
  );
}
