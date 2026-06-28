import { beforeEach, describe, expect, it, vi } from "vitest";
import { episodes, playlists, sources } from "@/db/schema";
import { savePlaybackProgress, savePlaylistVolume } from "./playback";

const {
  logMutationMock,
  revalidatePathMock,
  revalidateTagMock,
  returningResults,
  transactionMock,
  updateMock,
  updateSteps,
} = vi.hoisted(() => {
  const steps: Array<{
    table: unknown;
    values: Record<string, unknown>;
    whereArg: unknown;
  }> = [];
  const results = {
    episodes: [{ id: "episode-1" }],
    playlists: [{ id: "playlist-1" }],
    sources: [{ id: "source-1" }],
  };
  const transaction = vi.fn(
    async (
      callback: (tx: {
        update: (table: unknown) => {
          set: (values: Record<string, unknown>) => {
            where: (whereArg: unknown) => {
              returning: () => Promise<Array<{ id: string }>>;
            };
          };
        };
      }) => Promise<void>,
    ) => {
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
              },
            }),
          }),
        }),
      });
    },
  );

  const update = vi.fn((table) => ({
    set: (values: Record<string, unknown>) => ({
      where: (whereArg: unknown) => {
        steps.push({ table, values, whereArg });
        return {
          returning: async () => {
            if (table === episodes) return results.episodes;
            if (table === sources) return results.sources;
            if (table === playlists) return results.playlists;
            return [];
          },
        };
      },
    }),
  }));

  return {
    logMutationMock: vi.fn(),
    revalidatePathMock: vi.fn(),
    revalidateTagMock: vi.fn(),
    returningResults: results,
    transactionMock: transaction,
    updateMock: update,
    updateSteps: steps,
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
  revalidateTag: revalidateTagMock,
}));

vi.mock("@/db/client", () => ({
  db: {
    transaction: transactionMock,
    update: updateMock,
  },
}));

vi.mock("./playlists", () => ({
  logMutation: logMutationMock,
}));

describe("savePlaybackProgress", () => {
  beforeEach(() => {
    updateSteps.length = 0;
    transactionMock.mockClear();
    logMutationMock.mockReset();
    revalidatePathMock.mockReset();
    revalidateTagMock.mockReset();
    returningResults.episodes = [{ id: "episode-1" }];
    returningResults.sources = [{ id: "source-1" }];
    returningResults.playlists = [{ id: "playlist-1" }];
  });

  it("uses monotonic playback writes for episode and source progress", async () => {
    await savePlaybackProgress({
      playlistId: "playlist-1",
      sourceId: "source-1",
      episodeKey: "ep-1",
      seconds: 60.9,
    });

    expect(updateSteps).toHaveLength(3);

    const episodeUpdate = updateSteps.find((step) => step.table === episodes);
    const sourceUpdate = updateSteps.find((step) => step.table === sources);
    const playlistUpdate = updateSteps.find((step) => step.table === playlists);
    const episodeSeconds = episodeUpdate?.values.lastPlayedSeconds;
    const sourceSeconds = sourceUpdate?.values.lastPlayedSeconds;

    expect(episodeSeconds).toMatchObject({
      queryChunks: expect.arrayContaining([60]),
    });
    expect(sourceSeconds).toMatchObject({
      queryChunks: expect.arrayContaining([60]),
    });
    expect(playlistUpdate?.values).not.toHaveProperty("lastPlayedSeconds");
    expect(logMutationMock).toHaveBeenCalledWith(
      "playback.update",
      "Saved playback progress",
      "playlist-1",
    );
    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(revalidateTagMock).toHaveBeenCalledWith("playlists");
  });

  it("rejects mismatched playlist source episode chains without logging", async () => {
    returningResults.sources = [];

    await expect(
      savePlaybackProgress({
        playlistId: "playlist-1",
        sourceId: "source-1",
        episodeKey: "ep-1",
        seconds: 60,
      }),
    ).rejects.toThrow();

    expect(updateSteps).toHaveLength(2);
    expect(updateSteps.some((step) => step.table === sources)).toBe(true);
    expect(logMutationMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });
});

describe("savePlaylistVolume", () => {
  beforeEach(() => {
    updateSteps.length = 0;
    transactionMock.mockClear();
    updateMock.mockClear();
    logMutationMock.mockReset();
    revalidatePathMock.mockReset();
    revalidateTagMock.mockReset();
    returningResults.playlists = [{ id: "playlist-1" }];
  });

  it("updates the volume of the playlist and logs mutation", async () => {
    await savePlaylistVolume({
      playlistId: "playlist-1",
      volume: 0.8,
    });

    expect(updateSteps).toHaveLength(1);
    const playlistUpdate = updateSteps.find((step) => step.table === playlists);
    expect(playlistUpdate?.values.volume).toBe(0.8);
    expect(logMutationMock).toHaveBeenCalledWith(
      "playback.update",
      "Saved playlist volume to 80%",
      "playlist-1",
    );
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it("handles extreme volume values by clamping them", async () => {
    await savePlaylistVolume({
      playlistId: "playlist-1",
      volume: 1.5,
    });

    const playlistUpdate = updateSteps.find((step) => step.table === playlists);
    expect(playlistUpdate?.values.volume).toBe(1.0);
  });
});

