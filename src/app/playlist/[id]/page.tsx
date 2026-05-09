import { getPlaylistDetail } from "@/db/queries/playlist";
import { resolveInitialPlayback } from "@/lib/playback";
import { PlaylistDetailClient } from "@/components/playlist/playlist-detail-client";

export default async function PlaylistDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ source?: string; episode?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const playlist = await getPlaylistDetail(id);
  const initial = resolveInitialPlayback(playlist.sources, {
    sourceId: query.source ?? playlist.lastPlayedSourceId,
    episodeIndex: query.episode ?? null
  });

  return <PlaylistDetailClient playlist={playlist} initialPlayback={initial} />;
}
