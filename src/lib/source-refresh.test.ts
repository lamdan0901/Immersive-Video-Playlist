import { reconcileEpisodes } from "./source-refresh";

const existing = [
  { episodeKey: "ep-1", sortOrder: 0, deletedAt: null },
  { episodeKey: "ep-2", sortOrder: 1, deletedAt: null }
];

it("preserves imported order and marks removed episodes deleted", () => {
  const result = reconcileEpisodes(existing, [
    { episodeKey: "ep-2", title: "2", slug: "ep-2", filename: null, embedUrl: "embed2", m3u8Url: "m3u82" },
    { episodeKey: "ep-3", title: "3", slug: "ep-3", filename: null, embedUrl: "embed3", m3u8Url: "m3u83" }
  ]);

  expect(result.upserts.map((episode) => [episode.episodeKey, episode.sortOrder])).toEqual([["ep-2", 0], ["ep-3", 1]]);
  expect(result.softDeletes).toEqual(["ep-1"]);
});
