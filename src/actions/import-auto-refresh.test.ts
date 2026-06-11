import { beforeEach, describe, expect, it, vi } from "vitest";
import { performAutoRefresh } from "./import";

const {
  revalidatePathMock,
  revalidateTagMock,
  staleSources,
  updateWhereMock,
} = vi.hoisted(() => ({
  revalidatePathMock: vi.fn(),
  revalidateTagMock: vi.fn(),
  staleSources: [] as Array<{
    id: string;
    playlistId: string;
    sourceKey: string;
    sourceTitle: string;
    sortOrder: number;
    sourceUrl: string;
  }>,
  updateWhereMock: vi.fn(async () => {}),
}));

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
  revalidateTag: revalidateTagMock,
}));

vi.mock("@/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            orderBy: async () => staleSources,
          }),
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: updateWhereMock,
      }),
    }),
    transaction: vi.fn(),
  },
}));

vi.mock("./playlists", () => ({
  logMutation: vi.fn(),
}));

describe("performAutoRefresh", () => {
  beforeEach(() => {
    staleSources.length = 0;
    updateWhereMock.mockClear();
    revalidatePathMock.mockReset();
    revalidateTagMock.mockReset();
    delete process.env.NGUONC_PROXY_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_NGUONC_PROXY_API_BASE_URL;
  });

  it("refreshes sources one by one and waits before starting the next source", async () => {
    vi.useFakeTimers();

    staleSources.push(
      {
        id: "source-1",
        playlistId: "playlist-1",
        sourceKey: "source-1",
        sourceTitle: "Source 1",
        sortOrder: 0,
        sourceUrl: "https://example.com/source-1",
      },
      {
        id: "source-2",
        playlistId: "playlist-1",
        sourceKey: "source-2",
        sourceTitle: "Source 2",
        sortOrder: 1,
        sourceUrl: "https://example.com/source-2",
      },
    );

    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
    }));
    vi.stubGlobal("fetch", fetchMock);

    const timeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const refreshPromise = performAutoRefresh();

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://example.com/source-1",
      expect.objectContaining({
        cache: "no-store",
      }),
    );

    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.runOnlyPendingTimersAsync();

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    await expect(refreshPromise).resolves.toBe(2);
    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 3000);
    expect(updateWhereMock).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
