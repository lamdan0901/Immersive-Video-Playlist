import Link from "next/link";
import type { PlaylistSummary } from "@/db/queries/home";

function formatUtcDate(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function formatTime(value: string | null) {
  if (!value) return "Never played";
  return `Last played ${formatUtcDate(value)}`;
}

export function PlaylistCard({ playlist }: { playlist: PlaylistSummary }) {
  return (
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
  );
}
