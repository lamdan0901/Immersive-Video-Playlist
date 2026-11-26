import type { PlaylistSummary } from "@/db/queries/home";
import type { PlaylistGroup } from "@/db/queries/playlist-groups";
import type { SearchablePlaylist } from "@/lib/relevance";

export type PlaylistGroupEntry = SearchablePlaylist & {
  group: PlaylistGroup;
  playlists: PlaylistSummary[];
};

export function buildPlaylistLibrary(playlists: PlaylistSummary[], groups: PlaylistGroup[]) {
  const playlistsById = new Map(playlists.map((playlist) => [playlist.id, playlist]));
  const groupedIds = new Set<string>();
  const groupEntries: PlaylistGroupEntry[] = groups.map((group) => {
    const members = group.members.flatMap(({ playlistId }) => {
      const playlist = playlistsById.get(playlistId);
      if (!playlist) return [];
      groupedIds.add(playlistId);
      return [playlist];
    });
    const pinnedMembers = members.filter((playlist) => playlist.pinned);

    return {
      id: group.id,
      title: group.name || members[0]?.title || "Untitled group",
      group,
      playlists: members,
      sourceTitles: members.flatMap((playlist) => playlist.sourceTitles),
      metadataText: [group.note, ...members.flatMap((playlist) => [playlist.title, playlist.metadataText])].join(" "),
      pinned: pinnedMembers.length > 0,
      pinnedOrder: pinnedMembers.length ? Math.min(...pinnedMembers.map((playlist) => playlist.pinnedOrder)) : 0,
      lastPlayedAt: members.map((playlist) => playlist.lastPlayedAt).filter(Boolean).sort().at(-1) ?? null,
    };
  });

  return {
    standalone: playlists.filter((playlist) => !groupedIds.has(playlist.id)),
    groups: groupEntries,
  };
}
