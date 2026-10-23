import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractMetadataText } from "./home-metadata";

const { findManyMock, selectMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  selectMock: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  db: {
    query: { playlists: { findMany: findManyMock } },
    select: selectMock,
  },
}));

import { getPlaylistSummaries } from "./home";

function playlistRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "playlist-1",
    title: "Fate Chooses You",
    bannerOverrideUrl: null,
    derivedImageUrl: null,
    pinned: false,
    pinnedOrder: 0,
    lastPlayedAt: null,
    lastPlayedSourceId: null,
    lastPlayedEpisodeKey: null,
    metadata: {},
    version: 1,
    autoRefreshDisabled: false,
    updatedAt: new Date("2026-05-09T08:15:00.000Z"),
    sources: [],
    ...overrides,
  };
}

function sourceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "source-1",
    sourceTitle: "Vietsub",
    lastPlayedEpisodeKey: null,
    sourceUrl: "https://video.test/source-a.json",
    ...overrides,
  };
}

function queueSelectRows(rows: unknown[]) {
  selectMock.mockImplementationOnce(() => {
    const result = Promise.resolve(rows);
    return {
      from: () => ({
        where: () => Object.assign(result, { groupBy: async () => rows }),
      }),
    };
  });
}

describe("getPlaylistSummaries", () => {
  beforeEach(() => {
    findManyMock.mockReset();
    selectMock.mockReset();
  });

  it("skips the episode position query when no playlist has been played", async () => {
    findManyMock.mockResolvedValue([
      playlistRow({ sources: [sourceRow({ lastPlayedEpisodeKey: null })] }),
    ]);
    queueSelectRows([]);

    const summaries = await getPlaylistSummaries();

    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(summaries[0].activeSourceLastPlayedEpisodeIndex).toBe(0);
  });

  it("skips all episode queries when playlists have no sources", async () => {
    findManyMock.mockResolvedValue([playlistRow({ sources: [] })]);

    const summaries = await getPlaylistSummaries();

    expect(selectMock).not.toHaveBeenCalled();
    expect(summaries[0].activeSourceTotalEpisodes).toBe(0);
  });

  it("maps episode counts and last played positions to the active source", async () => {
    findManyMock.mockResolvedValue([
      playlistRow({
        lastPlayedSourceId: "source-1",
        lastPlayedEpisodeKey: "ep-2",
        sources: [
          sourceRow({ id: "source-1", lastPlayedEpisodeKey: "ep-2" }),
        ],
      }),
    ]);
    queueSelectRows([{ sourceId: "source-1", count: 12 }]);
    queueSelectRows([{ sourceId: "source-1", episodeKey: "ep-2", sortOrder: 2 }]);

    const summaries = await getPlaylistSummaries();

    expect(summaries[0].activeSourceTotalEpisodes).toBe(12);
    expect(summaries[0].activeSourceLastPlayedEpisodeIndex).toBe(2);
  });
});

it("extracts searchable text from current importer metadata shapes", () => {
  expect(
    extractMetadataText({
      name: "Vương Miện Hoàn Hảo",
      original_name: "Perfect Crown",
      description: "Korean romance drama",
      quality: "HD",
      language: "Vietsub",
      category: {
        "1": {
          group: { name: "Thể loại" },
          list: [{ name: "Lãng Mạn" }, { name: "Tình Cảm" }]
        },
        "2": {
          group: { name: "Quốc gia" },
          list: [{ name: "Hàn Quốc" }]
        }
      }
    })
  ).toContain("Perfect Crown");

  expect(
    extractMetadataText({
      name: "Vương Miện Hoàn Hảo",
      original_name: "Perfect Crown",
      description: "Korean romance drama",
      quality: "HD",
      language: "Vietsub",
      category: {
        "1": {
          group: { name: "Thể loại" },
          list: [{ name: "Lãng Mạn" }, { name: "Tình Cảm" }]
        },
        "2": {
          group: { name: "Quốc gia" },
          list: [{ name: "Hàn Quốc" }]
        }
      }
    })
  ).toContain("Lãng Mạn");

  expect(
    extractMetadataText({
      name: "Vương Miện Hoàn Hảo",
      original_name: "Perfect Crown",
      description: "Korean romance drama",
      quality: "HD",
      language: "Vietsub",
      category: {
        "1": {
          group: { name: "Thể loại" },
          list: [{ name: "Lãng Mạn" }, { name: "Tình Cảm" }]
        },
        "2": {
          group: { name: "Quốc gia" },
          list: [{ name: "Hàn Quốc" }]
        }
      }
    })
  ).toContain("Hàn Quốc");
});
