"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { createSourceFromUrl, refreshSource } from "@/actions/import";
import {
  softDeleteSource,
  updatePlaylistTitle,
  updateSource,
} from "@/actions/playlists";
import type { LinkType } from "@/lib/types";

type EditorDrawerProps = {
  playlist: {
    id: string;
    title: string;
    skipStartSeconds: number;
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
  const [skipStartMinutes, setSkipStartMinutes] = useState(
    String(Math.floor(playlist.skipStartSeconds / 60)),
  );
  const [skipStartSeconds, setSkipStartSeconds] = useState(
    String(playlist.skipStartSeconds % 60).padStart(2, "0"),
  );
  const [sourceTitle, setSourceTitle] = useState(source?.sourceTitle ?? "");
  const [sourceUrl, setSourceUrl] = useState(source?.sourceUrl ?? "");
  const [preferredLinkType, setPreferredLinkType] = useState<LinkType>(
    source?.preferredLinkType ?? "embed",
  );
  const [advancedJson, setAdvancedJson] = useState(initialAdvancedJson);
  const [status, setStatus] = useState<string | null>(null);
  const skipStartSecondsRef = useRef<HTMLInputElement>(null);

  function applySkipStartValue(totalSeconds: number) {
    const normalizedSeconds = Math.max(0, Math.floor(totalSeconds));
    setSkipStartMinutes(String(Math.floor(normalizedSeconds / 60)));
    setSkipStartSeconds(String(normalizedSeconds % 60).padStart(2, "0"));
  }

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

    const parsedSkipStartMinutes = Number(skipStartMinutes);
    const parsedSkipStartSeconds = Number(skipStartSeconds);
    if (
      !Number.isFinite(parsedSkipStartMinutes) ||
      parsedSkipStartMinutes < 0
    ) {
      setStatus("Skip start must be a non-negative number.");
      return;
    }

    if (
      !Number.isFinite(parsedSkipStartSeconds) ||
      parsedSkipStartSeconds < 0 ||
      parsedSkipStartSeconds > 59
    ) {
      setStatus("Skip start seconds must be between 0 and 59.");
      return;
    }

    const nextSkipStartSeconds =
      Math.floor(parsedSkipStartMinutes) * 60 +
      Math.floor(parsedSkipStartSeconds);

    if (
      playlistTitle.trim() !== playlist.title ||
      nextSkipStartSeconds !== playlist.skipStartSeconds
    ) {
      const playlistResult = await updatePlaylistTitle({
        adminSecret,
        playlistId: playlist.id,
        title: playlistTitle,
        skipStartSeconds: nextSkipStartSeconds,
        version: playlist.version,
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
          version: source.version,
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
    const trimmedUrl = sourceUrl.trim();
    if (!trimmedUrl) {
      setStatus("Source URL is required.");
      return;
    }

    try {
      new URL(trimmedUrl);
    } catch {
      setStatus("Source URL is not a valid URL.");
      return;
    }

    const result = await createSourceFromUrl({
      adminSecret,
      playlistId: playlist.id,
      playlistVersion: playlist.version,
      sourceUrl: trimmedUrl,
    });

    setStatus(result.ok ? result.data.message : result.error);
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
      sourceUrl,
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
      sourceVersion: source.version,
    });

    setStatus(result.ok ? "Source moved to trash." : result.error);
    if (result.ok) {
      router.refresh();
    }
  }

  function handleApplyJson() {
    try {
      const parsed = JSON.parse(advancedJson) as {
        playlist?: { title?: unknown; skipStartSeconds?: unknown };
        source?: {
          sourceTitle?: unknown;
          sourceUrl?: unknown;
          preferredLinkType?: unknown;
        } | null;
      };

      if (typeof parsed.playlist?.title === "string") {
        setPlaylistTitle(parsed.playlist.title);
      }

      if (parsed.playlist?.skipStartSeconds != null) {
        const parsedSkipStartValue = Number(parsed.playlist.skipStartSeconds);
        if (
          Number.isFinite(parsedSkipStartValue) &&
          parsedSkipStartValue >= 0
        ) {
          applySkipStartValue(parsedSkipStartValue);
        }
      }

      if (parsed.source && typeof parsed.source === "object") {
        if (typeof parsed.source.sourceTitle === "string") {
          setSourceTitle(parsed.source.sourceTitle);
        }

        if (typeof parsed.source.sourceUrl === "string") {
          setSourceUrl(parsed.source.sourceUrl);
        }

        if (
          parsed.source.preferredLinkType === "embed" ||
          parsed.source.preferredLinkType === "m3u8"
        ) {
          setPreferredLinkType(parsed.source.preferredLinkType);
        }
      }

      setStatus("Advanced JSON applied to the editor fields.");
    } catch {
      setStatus("Advanced JSON must be valid JSON.");
    }
  }

  function handleSkipStartMinutesChange(nextValue: string) {
    const digitsOnly = nextValue.replace(/\D/g, "").slice(0, 1);
    setSkipStartMinutes(digitsOnly);

    if (digitsOnly.length === 1) {
      skipStartSecondsRef.current?.focus();
      skipStartSecondsRef.current?.select();
    }
  }

  function handleSkipStartSecondsChange(nextValue: string) {
    const digitsOnly = nextValue.replace(/\D/g, "").slice(0, 2);
    setSkipStartSeconds(digitsOnly);
  }

  function handleSelectAllOnFocus(event: React.FocusEvent<HTMLInputElement>) {
    event.target.select();
  }

  return (
    <section
      className="playlist-detail-panel playlist-detail-source-panel"
      aria-label="Editor drawer"
    >
      <div className="playlist-detail-panel-header">
        <h2 style={{ margin: 0, fontSize: "1rem" }}>Editor</h2>
        {isPending ? (
          <span className="playlist-detail-chip-meta">Working...</span>
        ) : null}
      </div>

      <div className="playlist-editor-form">
        <div className="playlist-editor-row playlist-editor-row-3up">
          <label className="admin-unlock-field playlist-editor-field">
            <span>Playlist title</span>
            <input
              value={playlistTitle}
              onChange={(event) => setPlaylistTitle(event.target.value)}
            />
          </label>

          <div className="admin-unlock-field playlist-editor-field">
            <span>Skip start (m:ss)</span>
            <div className="playlist-editor-skip-group">
              <input
                aria-label="Skip start minutes"
                inputMode="numeric"
                pattern="[0-9]*"
                value={skipStartMinutes}
                onChange={(event) =>
                  handleSkipStartMinutesChange(event.target.value)
                }
                onFocus={handleSelectAllOnFocus}
              />
              <span
                aria-hidden="true"
                className="playlist-editor-skip-separator"
              >
                :
              </span>
              <input
                ref={skipStartSecondsRef}
                aria-label="Skip start seconds"
                inputMode="numeric"
                pattern="[0-9]*"
                value={skipStartSeconds}
                onChange={(event) =>
                  handleSkipStartSecondsChange(event.target.value)
                }
                onFocus={handleSelectAllOnFocus}
              />
            </div>
          </div>

          <label className="admin-unlock-field playlist-editor-field">
            <span>Preferred link type</span>
            <select
              className="playlist-editor-select"
              value={preferredLinkType}
              onChange={(event) =>
                setPreferredLinkType(event.target.value as LinkType)
              }
            >
              <option value="embed">embed</option>
              <option value="m3u8">m3u8</option>
            </select>
          </label>
        </div>

        <div className="playlist-editor-row playlist-editor-row-source-actions">
          <label className="admin-unlock-field playlist-editor-field">
            <span>Source title</span>
            <input
              value={sourceTitle}
              onChange={(event) => setSourceTitle(event.target.value)}
            />
          </label>

          <label className="admin-unlock-field playlist-editor-field">
            <span>Source URL</span>
            <input
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
            />
          </label>

          <div className="playlist-editor-row playlist-editor-row-button-grid">
            <button
              type="button"
              className="ghost-button"
              disabled={
                isPending ||
                !sourceUrl.trim() ||
                sourceUrl.trim() === (source?.sourceUrl ?? "")
              }
              onClick={() => runWithAdminSecret(handleCreate)}
            >
              Create New Source
            </button>
            <button
              type="button"
              className="ghost-button"
              disabled={isPending}
              onClick={() => runWithAdminSecret(handleRefresh)}
            >
              Refresh Source
            </button>
            <button
              type="button"
              className="accent-button"
              disabled={isPending}
              onClick={() => runWithAdminSecret(handleSave)}
            >
              Save
            </button>
            <button
              type="button"
              className="ghost-button"
              disabled={isPending || !source}
              onClick={() => runWithAdminSecret(handleDelete)}
            >
              Delete Source
            </button>
          </div>
        </div>

        {status ? (
          <p className="playlist-detail-chip-meta" role="status">
            {status}
          </p>
        ) : null}

        <details className="playlist-editor-advanced-row">
          <summary>Advanced JSON</summary>
          <div
            className="playlist-editor-row playlist-editor-row-actions"
            style={{ marginTop: 12 }}
          >
            <button
              type="button"
              className="ghost-button"
              disabled={isPending}
              onClick={handleApplyJson}
            >
              Apply JSON
            </button>
            <button
              type="button"
              className="ghost-button"
              disabled={isPending}
              onClick={() => setAdvancedJson(initialAdvancedJson)}
            >
              Reset JSON
            </button>
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
              color: "var(--color-text)",
            }}
          />
        </details>
      </div>
    </section>
  );
}
