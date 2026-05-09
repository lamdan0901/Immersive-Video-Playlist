import { rankPlaylists } from "./relevance";

const rows = [
  { id: "1", title: "Fate Chooses You", sourceTitles: ["Vietsub"], metadataText: "Chinese drama", pinned: false, pinnedOrder: 0, lastPlayedAt: "2026-05-01T00:00:00.000Z" },
  { id: "2", title: "Perfect Crown", sourceTitles: ["Thuyet Minh"], metadataText: "Korean romance", pinned: true, pinnedOrder: 1, lastPlayedAt: null },
  { id: "3", title: "Crown Fate", sourceTitles: ["Vietsub"], metadataText: "romance fate", pinned: true, pinnedOrder: 0, lastPlayedAt: null }
];

it("ranks title matches and keeps pinned order within relevance tier", () => {
  expect(rankPlaylists(rows, "crown").map((row) => row.id)).toEqual(["3", "2"]);
});

it("returns all rows sorted by last played then pinned when query is empty", () => {
  expect(rankPlaylists(rows, "").map((row) => row.id)).toEqual(["1", "3", "2"]);
});
