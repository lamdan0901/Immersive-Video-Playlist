import { beforeEach, describe, expect, it, vi } from "vitest";
import { episodes, playlists, sources } from "@/db/schema";
import { savePlaybackProgress } from "./playback";

const { logMutationMock, returningResults, transactionMock, updateSteps } = vi.hoisted(() => {
  const steps: Array<{ table: unknown; values: Record<string, unknown>; whereArg: unknown }> = [];
  const results = {
    episodes: [{ id: "episode-1" }],
    playlists: [{ id: "playlist-1" }],
    sources: [{ id: "source-1" }]
  };
  const transaction = vi.fn(async (callback: (tx: {
    update: (table: unknown) => {
      set: (values: Record<string, unknown>) => {
        where: (whereArg: unknown) => {
          returning: () => Promise<Array<{ id: string }>>;
        };
      };
    };
  }) => Promise<void>) => {
    await callback({
      update: (table) => ({
        set: (values) => ({
          where: (whereArg) => ({
            returning: async () => {
            steps.push({ table, values, whereArg });
              if (table === episodes) return results.episodes;
              if (table === sources) return results.sources;
              if (table === playlists) return results.playlists;
              return [];
            }
          })
        })
      })
    });
  });

  return {
    logMutationMock: vi.fn(),
    returningResults: results,
    transactionMock: transaction,
    updateSteps: steps
  };
});

vi.mock("@/db/client", () => ({
  db: {
    transaction: transactionMock
  }
}));

vi.mock("./playlists", () => ({
  logMutation: logMutationMock
}));

describe("savePlaybackProgress", () => {
  beforeEach(() => {
    updateSteps.length = 0;
    transactionMock.mockClear();
    logMutationMock.mockReset();
    returningResults.episodes = [{ id: "episode-1" }];
    returningResults.sources = [{ id: "source-1" }];
    returningResults.playlists = [{ id: "playlist-1" }];
  });

  it("uses monotonic playback writes for episode and source progress", async () => {
    await savePlaybackProgress({
      playlistId: "playlist-1",
      sourceId: "source-1",
      episodeKey: "ep-1",
      seconds: 60.9
    });

    expect(updateSteps).toHaveLength(3);

    const episodeUpdate = updateSteps.find((step) => step.table === episodes);
    const sourceUpdate = updateSteps.find((step) => step.table === sources);
    const playlistUpdate = updateSteps.find((step) => step.table === playlists);
    const episodeSeconds = episodeUpdate?.values.lastPlayedSeconds;
    const sourceSeconds = sourceUpdate?.values.lastPlayedSeconds;

    expect(episodeSeconds).toMatchObject({
      queryChunks: expect.arrayContaining([60])
    });
    expect(sourceSeconds).toMatchObject({
      queryChunks: expect.arrayContaining([60])
    });
    expect(playlistUpdate?.values).not.toHaveProperty("lastPlayedSeconds");
    expect(logMutationMock).toHaveBeenCalledWith("playback.update", "Saved playback progress", "playlist-1");
  });

  it("rejects mismatched playlist source episode chains without logging", async () => {
    returningResults.sources = [];

    await expect(savePlaybackProgress({
      playlistId: "playlist-1",
      sourceId: "source-1",
      episodeKey: "ep-1",
      seconds: 60
    })).rejects.toThrow();

    expect(updateSteps).toHaveLength(2);
    expect(updateSteps.some((step) => step.table === sources)).toBe(true);
    expect(logMutationMock).not.toHaveBeenCalled();
  });
});
