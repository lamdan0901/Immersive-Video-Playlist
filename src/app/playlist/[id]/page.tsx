import { getPlaylistDetail } from "@/db/queries/playlist";
import { getPlaylistSummaries } from "@/db/queries/home";
import {
  resolveInitialPlayback,
  resolveSkipStartSeconds,
} from "@/lib/playback";
import { PlaylistDetailClient } from "@/components/playlist/playlist-detail-client";
import { AutoRefreshTrigger } from "@/components/auto-refresh-trigger";

export const dynamic = "force-dynamic";

export default async function PlaylistDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ source?: string; episode?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const [playlist, allPlaylists] = await Promise.all([
    getPlaylistDetail(id),
    getPlaylistSummaries(),
  ]);
  const initial = resolveInitialPlayback(playlist.sources, {
    sourceId: query.source ?? playlist.lastPlayedSourceId,
    episodeIndex: query.episode ?? null,
  });

  return (
    <>
      <AutoRefreshTrigger playlistId={id} />
      <PlaylistDetailClient
        playlist={{
          ...playlist,
          skipStartSeconds: resolveSkipStartSeconds(playlist.metadata),
        }}
        initialPlayback={initial}
        allPlaylists={allPlaylists.map((p) => ({ id: p.id, title: p.title }))}
      />
    </>
  );
}
