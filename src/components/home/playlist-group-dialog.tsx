"use client";

import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { ArrowDown, ArrowUp, GripVertical, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { removePlaylistGroup, savePlaylistGroup } from "@/actions/playlist-groups";
import type { PlaylistSummary } from "@/db/queries/home";
import type { ActionResult } from "@/lib/admin";
import { PlaylistCard } from "./playlist-card";
import type { PlaylistGroupEntry } from "./playlist-library";

export function PlaylistGroupDialog({
  entry,
  standalone,
  canEdit,
  onClose,
}: {
  entry?: PlaylistGroupEntry;
  standalone: PlaylistSummary[];
  canEdit: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [editing, setEditing] = useState(!entry);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const saveLock = useRef(false);
  const router = useRouter();

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  function close() {
    if (!saveLock.current) dialogRef.current?.close();
  }

  async function save(action: (adminSecret: string) => Promise<ActionResult>) {
    if (saveLock.current) return;
    const adminSecret = localStorage.getItem("adminSecret");
    if (!adminSecret) {
      setError("Admin unlock required.");
      return;
    }

    saveLock.current = true;
    setSaving(true);
    setError("");
    try {
      const result = await action(adminSecret);
      if (!result.ok) {
        setError(result.error);
        if (result.conflict) router.refresh();
        return;
      }
      dialogRef.current?.close();
    } catch {
      setError("Could not save the group. Try again.");
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="playlist-group-dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(event) => { if (saveLock.current) event.preventDefault(); }}
    >
      <header className="playlist-group-dialog-header">
        <h2 id={titleId}>{editing ? (entry ? "Edit group" : "New group") : entry?.title}</h2>
        <div className="playlist-group-actions">
          {canEdit && !editing ? (
            <button type="button" className="ghost-button" onClick={() => setEditing(true)}>Edit group</button>
          ) : null}
          <button type="button" className="playlist-group-icon-button" aria-label="Close group" onClick={close} disabled={saving}>
            <X size={20} />
          </button>
        </div>
      </header>
      {editing ? (
        <PlaylistGroupEditor
          entry={entry}
          standalone={standalone}
          saving={saving}
          error={error}
          onSave={save}
          onCancel={() => {
            if (!entry) {
              close();
              return;
            }
            setEditing(false);
            setError("");
          }}
        />
      ) : (
        <>
          {entry?.group.note ? <p className="playlist-group-note">{entry.group.note}</p> : null}
          {entry?.playlists.length ? (
            <div className="playlist-grid playlist-group-playlists">
              {entry.playlists.map((playlist) => <PlaylistCard key={playlist.id} playlist={playlist} />)}
            </div>
          ) : <p className="playlist-group-note">No playlists in this group.</p>}
        </>
      )}
    </dialog>
  );
}

function PlaylistGroupEditor({
  entry,
  standalone,
  saving,
  error,
  onSave,
  onCancel,
}: {
  entry?: PlaylistGroupEntry;
  standalone: PlaylistSummary[];
  saving: boolean;
  error: string;
  onSave: (action: (adminSecret: string) => Promise<ActionResult>) => Promise<void>;
  onCancel: () => void;
}) {
  const [group] = useState(() => entry ? { id: entry.group.id, version: entry.group.version } : undefined);
  const [name, setName] = useState(entry?.group.name ?? "");
  const [note, setNote] = useState(entry?.group.note ?? "");
  const [members, setMembers] = useState(entry?.playlists ?? []);
  const [drag, setDrag] = useState<{ id: string; target?: string } | null>(null);
  const available = [...(entry?.playlists ?? []), ...standalone]
    .filter((playlist) => !members.some((member) => member.id === playlist.id))
    .sort((a, b) => a.title.localeCompare(b.title));

  function movePlaylist(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || to >= members.length) return;
    const reordered = [...members];
    const [playlist] = reordered.splice(from, 1);
    reordered.splice(to, 0, playlist);
    setMembers(reordered);
  }

  function playlistAtPointer(event: PointerEvent<HTMLElement>) {
    return document.elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-group-member]")?.dataset.groupMember;
  }

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        await onSave((adminSecret) => savePlaylistGroup({
          adminSecret,
          group,
          name,
          note,
          playlistIds: members.map((playlist) => playlist.id),
        }));
      }}
    >
      <fieldset className="playlist-group-editor" disabled={saving}>
        <label>
          Group name
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={200}
            placeholder={members[0]?.title ?? "First playlist’s name"} />
        </label>
        <label>
          Note
          <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={4000} rows={3} />
        </label>
        <label>
          Add playlist
          <select
            value=""
            disabled={!available.length}
            onChange={(event) => {
              const playlist = available.find(({ id }) => id === event.target.value);
              if (playlist) setMembers([...members, playlist]);
            }}
          >
            <option value="" disabled>{available.length ? "Choose a playlist" : "No available playlists"}</option>
            {available.map((playlist) => <option key={playlist.id} value={playlist.id}>{playlist.title}</option>)}
          </select>
        </label>
        {members.length ? (
          <ol className="playlist-group-members" aria-label="Playlist order">
            {members.map((playlist, index) => (
              <li key={playlist.id} data-group-member={playlist.id} data-drop-target={drag?.target === playlist.id && drag.id !== playlist.id}>
                <span
                  className="playlist-group-drag-handle"
                  aria-hidden="true"
                  onPointerDown={(event) => {
                    if (!event.isPrimary || event.button !== 0 || saving) return;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setDrag({ id: playlist.id });
                  }}
                  onPointerMove={(event) => {
                    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                    setDrag({ id: playlist.id, target: playlistAtPointer(event) });
                  }}
                  onPointerUp={(event) => {
                    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                    const target = playlistAtPointer(event);
                    movePlaylist(index, members.findIndex(({ id }) => id === target));
                    setDrag(null);
                  }}
                  onLostPointerCapture={() => setDrag(null)}
                >
                  <GripVertical size={18} />
                </span>
                <span className="playlist-group-member-title">{playlist.title}</span>
                <div className="playlist-group-actions">
                  <button type="button" className="playlist-group-icon-button" aria-label={`Move ${playlist.title} up`}
                    disabled={index === 0} onClick={() => movePlaylist(index, index - 1)}>
                    <ArrowUp size={16} />
                  </button>
                  <button type="button" className="playlist-group-icon-button" aria-label={`Move ${playlist.title} down`}
                    disabled={index === members.length - 1} onClick={() => movePlaylist(index, index + 1)}>
                    <ArrowDown size={16} />
                  </button>
                  <button type="button" className="playlist-group-icon-button" aria-label={`Remove ${playlist.title} from group`}
                    onClick={() => setMembers(members.filter(({ id }) => id !== playlist.id))}>
                    <X size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        ) : null}
        {error ? <p className="home-toolbar-inline-error" role="alert">{error}</p> : null}
        <footer className="playlist-group-editor-footer">
          {group ? (
            <button type="button" className="ghost-button" onClick={async () => {
              if (!window.confirm("Remove this group and its note? Its playlists will return to the library.")) return;
              await onSave((adminSecret) => removePlaylistGroup({ adminSecret, group }));
            }}>Ungroup</button>
          ) : null}
          <div className="playlist-group-actions">
            <button type="button" className="ghost-button" onClick={onCancel}>Cancel</button>
            <button type="submit" className="accent-button" disabled={!members.length}>{saving ? "Saving…" : "Save group"}</button>
          </div>
        </footer>
      </fieldset>
    </form>
  );
}
