import { canonicalHash, matchImportedSource, reconcileEpisodes } from "./source-refresh";

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

it("hashes objects stably regardless of key order", () => {
  const first = canonicalHash({
    sourceKey: "alpha",
    metadata: {
      b: 2,
      a: 1
    },
    episodes: [
      { episodeKey: "ep-1", title: "One" }
    ]
  });

  const second = canonicalHash({
    episodes: [
      { title: "One", episodeKey: "ep-1" }
    ],
    metadata: {
      a: 1,
      b: 2
    },
    sourceKey: "alpha"
  });

  expect(first).toBe(second);
});

it("matches imported source by sort order when upstream title and key change", () => {
  const result = matchImportedSource(
    {
      sourceKey: "vip-server",
      sourceTitle: "VIP Server",
      sortOrder: 1
    },
    [
      {
        sourceKey: "standard-server",
        sourceTitle: "Standard Server",
        sourceUrl: "https://example.com/a",
        preferredLinkType: "embed",
        episodes: []
      },
      {
        sourceKey: "renamed-vip",
        sourceTitle: "VIP Server 4K",
        sourceUrl: "https://example.com/b",
        preferredLinkType: "m3u8",
        episodes: []
      }
    ]
  );

  expect(result.sourceKey).toBe("renamed-vip");
});
