import ophim from "@/test/fixtures/sample-ophim.json";
import nguonc from "@/test/fixtures/sample-nguonc.json";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { episodes, playlists, sources, sourceSnapshots } from "@/db/schema";
import {
  createPlaylistFromImportedJson,
  createSourceFromUrl,
  fetchSourceJson,
} from "./import";

const {
  logMutationMock,
  playlistInsertValues,
  revalidatePathMock,
  revalidateTagMock,
  sourceInsertValues,
  transactionMock,
} = vi.hoisted(() => {
  const playlistValues: Record<string, unknown>[] = [];
  const sourceValues: Record<string, unknown>[] = [];

  const transaction = vi.fn(async (callback: (tx: {
    delete: (table: unknown) => {
      where: () => Promise<void>;
    };
    insert: (table: unknown) => {
      values: (values: Record<string, unknown> | Record<string, unknown>[]) => unknown;
    };
    select: () => {
      from: (table: unknown) => {
        where: () => unknown;
      };
    };
    update: (table: unknown) => {
      set: (values: Record<string, unknown>) => {
        where: () => {
          returning: () => Promise<Array<{ id: string }>>;
        };
      };
    };
  }) => Promise<unknown>) => {
    let sourceIndex = 0;

    return callback({
      delete: () => ({
        where: async () => {},
      }),
      insert: (table) => ({
        values: (values) => {
          if (table === playlists) {
            playlistValues.push(values as Record<string, unknown>);
            return {
              returning: async () => [{ id: "playlist-1" }],
            };
          }

          if (table === sources) {
            sourceValues.push(values as Record<string, unknown>);
            return {
              returning: async () => [{ id: `source-${++sourceIndex}` }],
            };
          }

          if (table === sourceSnapshots) {
            return {
              onConflictDoNothing: async () => {},
            };
          }

          if (table === episodes) {
            return Promise.resolve();
          }

          throw new Error("Unexpected insert table");
        },
      }),
      select: () => ({
        from: (table) => ({
          where: () => {
            if (table === sourceSnapshots) {
              return {
                orderBy: async () => [],
              };
            }

            if (table === sources) {
              return Promise.resolve([{ maxOrder: -1 }]);
            }

            throw new Error("Unexpected select table");
          },
        }),
      }),
      update: (table) => ({
        set: () => ({
          where: () => ({
            returning: async () => (table === playlists ? [{ id: "playlist-1" }] : []),
          }),
        }),
      }),
    });
  });

  return {
    logMutationMock: vi.fn(),
    playlistInsertValues: playlistValues,
    revalidatePathMock: vi.fn(),
    revalidateTagMock: vi.fn(),
    sourceInsertValues: sourceValues,
    transactionMock: transaction,
  };
});

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
  revalidateTag: revalidateTagMock,
}));

vi.mock("@/db/client", () => ({
  db: {
    transaction: transactionMock,
  },
}));

vi.mock("./playlists", () => ({
  logMutation: logMutationMock,
}));

describe("createSourceFromUrl", () => {
  beforeEach(() => {
    process.env.ADMIN_SECRET = "secret";
    delete process.env.NGUONC_PROXY_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_NGUONC_PROXY_API_BASE_URL;
    playlistInsertValues.length = 0;
    sourceInsertValues.length = 0;
    transactionMock.mockClear();
    logMutationMock.mockReset();
    revalidatePathMock.mockReset();
    revalidateTagMock.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ophim,
      })),
    );
  });

  it("uses the source URL hostname as the created source title", async () => {
    const result = await createSourceFromUrl({
      adminSecret: "secret",
      playlistId: "playlist-1",
      playlistVersion: 1,
      sourceUrl: "https://ophim1.com/v1/api/phim/vu-lam-linh",
    });

    expect(result.ok).toBe(true);
    expect(sourceInsertValues).not.toHaveLength(0);
    expect(sourceInsertValues.map((values) => values.sourceTitle)).toEqual([
      "ophim1.com",
    ]);
  });

  it("falls back to the NguonC film page when the API returns 403", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 403 })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => `
            <html>
              <head>
                <link rel="canonical" href="https://phim.nguonc.com/phim/huyen-thoai-linh-bep">
                <meta property="og:title" content="Huyền Thoại Lính Bếp - The Legend of Kitchen Soldier">
                <meta property="og:image" content="{&quot;original&quot;:&quot;/public/images/Post/2/huyen-thoai-linh-bep.jpg&quot;,&quot;poster&quot;:&quot;/public/images/Post/2/huyen-thoai-linh-bep-1.jpg&quot;}">
              </head>
              <body>
                <h1>Huyền Thoại Lính Bếp</h1>
                <script>
                  var episodes = [{"server_name":"Vietsub #1","list":[{"name":"1","slug":"tap-1","embed":"https://embed.test/1","m3u8":"https://m3u8.test/1.m3u8"}]}];
                </script>
              </body>
            </html>
          `,
        }),
    );

    const result = await createSourceFromUrl({
      adminSecret: "secret",
      playlistId: "playlist-1",
      playlistVersion: 1,
      sourceUrl: "https://phim.nguonc.com/phim/huyen-thoai-linh-bep",
    });

    expect(result.ok).toBe(true);
    expect(sourceInsertValues).not.toHaveLength(0);
    expect(sourceInsertValues.map((values) => values.sourceTitle)).toEqual([
      "phim.nguonc.com",
    ]);
  });

  it("creates NguonC playlists from browser-fetched JSON and disables auto-refresh", async () => {
    const result = await createPlaylistFromImportedJson({
      adminSecret: "secret",
      sourceUrl: "https://phim.nguonc.com/phim/huyen-thoai-linh-bep",
      importedJson: nguonc,
    });

    expect(result.ok).toBe(true);
    expect(playlistInsertValues).not.toHaveLength(0);
    expect(playlistInsertValues[0]?.autoRefreshDisabled).toBe(true);
    expect(sourceInsertValues.map((values) => values.sourceTitle)).toEqual([
      "phim.nguonc.com",
    ]);
  });
});

describe("fetchSourceJson", () => {
  beforeEach(() => {
    delete process.env.NGUONC_PROXY_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_NGUONC_PROXY_API_BASE_URL;
  });

  it("reconstructs a NguonC payload from HTML fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 403 })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => `
            <html>
              <head>
                <link rel="canonical" href="https://phim.nguonc.com/phim/huyen-thoai-linh-bep">
                <meta property="og:title" content="Huyền Thoại Lính Bếp - The Legend of Kitchen Soldier">
                <meta property="og:image" content="{&quot;original&quot;:&quot;/public/images/Post/2/huyen-thoai-linh-bep.jpg&quot;,&quot;poster&quot;:&quot;/public/images/Post/2/huyen-thoai-linh-bep-1.jpg&quot;}">
              </head>
              <body>
                <h1>Huyền Thoại Lính Bếp</h1>
                <script>
                  var episodes = [{"server_name":"Vietsub #1","list":[{"name":"1","slug":"tap-1","embed":"https://embed.test/1"}]}];
                </script>
              </body>
            </html>
          `,
        }),
    );

    const payload = await fetchSourceJson(
      "https://phim.nguonc.com/api/film/huyen-thoai-linh-bep",
    );

    expect((payload as { movie: { name: string } }).movie.name).toBe(
      "Huyền Thoại Lính Bếp",
    );
  });

  it("uses the configured NguonC relay for server-side fetches", async () => {
    process.env.NGUONC_PROXY_API_BASE_URL = "https://relay.example.com/api/film";

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => nguonc,
    }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchSourceJson("https://phim.nguonc.com/api/film/huyen-thoai-linh-bep");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://relay.example.com/api/film/huyen-thoai-linh-bep",
      expect.objectContaining({
        cache: "no-store",
        headers: undefined,
      }),
    );
  });
});
