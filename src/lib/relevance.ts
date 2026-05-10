export type SearchablePlaylist = {
  id: string;
  title: string;
  sourceTitles: string[];
  metadataText: string;
  pinned: boolean;
  pinnedOrder: number;
  lastPlayedAt: string | null;
};

function score(row: SearchablePlaylist, query: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const title = row.title.toLowerCase();
  const source = row.sourceTitles.join(" ").toLowerCase();
  const metadata = row.metadataText.toLowerCase();
  let total = 0;
  if (title === q) total += 100;
  if (title.includes(q)) total += 60;
  if (source.includes(q)) total += 30;
  if (metadata.includes(q)) total += 10;
  return total;
}

export function rankPlaylists<T extends SearchablePlaylist>(rows: T[], query: string): T[] {
  const trimmed = query.trim();

  if (!trimmed) {
    return [...rows].sort((a, b) => {
      const aTime = a.lastPlayedAt ? Date.parse(a.lastPlayedAt) : 0;
      const bTime = b.lastPlayedAt ? Date.parse(b.lastPlayedAt) : 0;
      if (bTime !== aTime) return bTime - aTime;
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.pinned && b.pinned && a.pinnedOrder !== b.pinnedOrder) return a.pinnedOrder - b.pinnedOrder;
      return a.title.localeCompare(b.title);
    });
  }

  return rows
    .map((row) => ({ row, score: score(row, trimmed) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.row.pinned !== b.row.pinned) return a.row.pinned ? -1 : 1;
      if (a.row.pinned && b.row.pinned && a.row.pinnedOrder !== b.row.pinnedOrder) return a.row.pinnedOrder - b.row.pinnedOrder;
      const aTime = a.row.lastPlayedAt ? Date.parse(a.row.lastPlayedAt) : 0;
      const bTime = b.row.lastPlayedAt ? Date.parse(b.row.lastPlayedAt) : 0;
      return bTime - aTime;
    })
    .map((entry) => entry.row);
}
