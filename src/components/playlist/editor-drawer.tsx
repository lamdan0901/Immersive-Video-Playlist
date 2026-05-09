"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { refreshSource } from "@/actions/import";
import {
  createBlankSource,
  softDeleteSource,
  updatePlaylistTitle,
  updateSource
} from "@/actions/playlists";
import type { LinkType } from "@/lib/types";

type EditorDrawerProps = {
  playlist: {
    id: string;
    title: string;
    version: number;
  };
  source: {
    id: string;
    sourceTitle: string;
    sourceUrl: string;
    preferredLinkType: LinkType;
    version: number;
  } | null;
};

export function EditorDrawer({ playlist, source }: EditorDrawerProps) {
  const router = useRouter();
  const initialAdvancedJson = JSON.stringify({ playlist, source }, null, 2);
  const [isPending, startTransition] = useTransition();
  const [playlistTitle, setPlaylistTitle] = useState(playlist.title);
  const [sourceTitle, setSourceTitle] = useState(source?.sourceTitle ?? "");
  const [sourceUrl, setSourceUrl] = useState(source?.sourceUrl ?? "");
  const [preferredLinkType, setPreferredLinkType] = useState<LinkType>(source?.preferredLinkType ?? "embed");
  const [advancedJson, setAdvancedJson] = useState(initialAdvancedJson);
  const [status, setStatus] = useState<string | null>(null);

  function runWithAdminSecret(action: (adminSecret: string) => Promise<void>) {
    const adminSecret = window.localStorage.getItem("adminSecret");
    if (!adminSecret) {
      setStatus("Admin unlock required");
      return;
    }

    startTransition(() => {
      void action(adminSecret);
    });
  }

  async function handleSave(adminSecret: string) {
    setStatus(null);

    if (playlistTitle.trim() !== playlist.title) {
      const playlistResult = await updatePlaylistTitle({
        adminSecret,
        playlistId: playlist.id,
        title: playlistTitle,
        version: playlist.version
      });

      if (!playlistResult.ok) {
        setStatus(playlistResult.error);
        return;
      }
    }

    if (source) {
      const sourceChanged =
        sourceTitle.trim() !== source.sourceTitle ||
        sourceUrl.trim() !== source.sourceUrl ||
        preferredLinkType !== source.preferredLinkType;

      if (sourceChanged) {
        const sourceResult = await updateSource({
          adminSecret,
          playlistId: playlist.id,
          sourceId: source.id,
          sourceTitle,
          sourceUrl,
          preferredLinkType,
          version: source.version
        });

        if (!sourceResult.ok) {
          setStatus(sourceResult.error);
          return;
        }
      }
    }

    setStatus("Saved.");
    router.refresh();
  }

  async function handleCreate(adminSecret: string) {
    const result = await createBlankSource({
      adminSecret,
      playlistId: playlist.id,
      playlistVersion: playlist.version,
      sourceTitle: "New Source",
      sourceUrl: "",
      preferredLinkType: "embed"
    });

    setStatus(result.ok ? "Created a new blank source." : result.error);
    if (result.ok) {
      router.refresh();
    }
  }

  async function handleRefresh(adminSecret: string) {
    if (!source) {
      setStatus("No source selected.");
      return;
    }

    const result = await refreshSource({
      adminSecret,
      playlistId: playlist.id,
      sourceId: source.id,
      sourceUrl
    });

    setStatus(result.ok ? result.data.message : result.error);
    if (result.ok) {
      router.refresh();
    }
  }

  async function handleDelete(adminSecret: string) {
    if (!source) {
      setStatus("No source selected.");
      return;
    }

    const result = await softDeleteSource({
      adminSecret,
      playlistId: playlist.id,
      playlistVersion: playlist.version,
      sourceId: source.id,
      sourceVersion: source.version
    });

    setStatus(result.ok ? "Source moved to trash." : result.error);
    if (result.ok) {
      router.refresh();
    }
  }

  function handleApplyJson() {
    try {
      const parsed = JSON.parse(advancedJson) as {
        playlist?: { title?: unknown };
        source?: {
          sourceTitle?: unknown;
          sourceUrl?: unknown;
          preferredLinkType?: unknown;
        } | null;
      };

      if (typeof parsed.playlist?.title === "string") {
        setPlaylistTitle(parsed.playlist.title);
      }

      if (parsed.source && typeof parsed.source === "object") {
        if (typeof parsed.source.sourceTitle === "string") {
          setSourceTitle(parsed.source.sourceTitle);
        }

        if (typeof parsed.source.sourceUrl === "string") {
          setSourceUrl(parsed.source.sourceUrl);
        }

        if (parsed.source.preferredLinkType === "embed" || parsed.source.preferredLinkType === "m3u8") {
          setPreferredLinkType(parsed.source.preferredLinkType);
        }
      }

      setStatus("Advanced JSON applied to the editor fields.");
    } catch {
      setStatus("Advanced JSON must be valid JSON.");
    }
  }

  return (
    <section className="playlist-detail-panel playlist-detail-source-panel" aria-label="Editor drawer">
      <div className="playlist-detail-panel-header">
        <h2 style={{ margin: 0, fontSize: "1rem" }}>Editor</h2>
        {isPending ? <span className="playlist-detail-chip-meta">Working...</span> : null}
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        <label className="admin-unlock-field">
          <span>Playlist title</span>
          <input value={playlistTitle} onChange={(event) => setPlaylistTitle(event.target.value)} />
        </label>

        <label className="admin-unlock-field">
          <span>Source title</span>
          <input value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} />
        </label>

        <label className="admin-unlock-field">
          <span>Source URL</span>
          <input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} />
        </label>

        <label className="admin-unlock-field">
          <span>Preferred link type</span>
          <select
            value={preferredLinkType}
            onChange={(event) => setPreferredLinkType(event.target.value as LinkType)}
            style={{
              padding: "12px 14px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 8,
              background: "rgba(255, 255, 255, 0.04)",
              color: "var(--color-text)"
            }}
          >
            <option value="embed">embed</option>
            <option value="m3u8">m3u8</option>
          </select>
        </label>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" className="ghost-button" disabled={isPending} onClick={() => runWithAdminSecret(handleCreate)}>
            Create New Source
          </button>
          <button type="button" className="ghost-button" disabled={isPending} onClick={() => runWithAdminSecret(handleRefresh)}>
            Refresh Source
          </button>
          <button type="button" className="accent-button" disabled={isPending} onClick={() => runWithAdminSecret(handleSave)}>
            Save
          </button>
          <button type="button" className="ghost-button" disabled={isPending || !source} onClick={() => runWithAdminSecret(handleDelete)}>
            Delete Source
          </button>
        </div>

        {status ? <p className="playlist-detail-chip-meta" role="status">{status}</p> : null}

        <details>
          <summary>Advanced JSON</summary>
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button type="button" className="ghost-button" disabled={isPending} onClick={handleApplyJson}>
                Apply JSON
              </button>
              <button type="button" className="ghost-button" disabled={isPending} onClick={() => setAdvancedJson(initialAdvancedJson)}>
                Reset JSON
              </button>
            </div>
          </div>
          <textarea
            rows={12}
            value={advancedJson}
            onChange={(event) => setAdvancedJson(event.target.value)}
            style={{
              width: "100%",
              marginTop: 12,
              padding: "12px 14px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 8,
              background: "rgba(255, 255, 255, 0.04)",
              color: "var(--color-text)"
            }}
          />
        </details>
      </div>
    </section>
  );
}
