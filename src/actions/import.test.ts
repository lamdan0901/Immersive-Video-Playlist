import ophim from "@/test/fixtures/sample-ophim.json";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { episodes, playlists, sources, sourceSnapshots } from "@/db/schema";
import { createSourceFromUrl } from "./import";

const {
  logMutationMock,
  revalidatePathMock,
  revalidateTagMock,
  sourceInsertValues,
  transactionMock,
} = vi.hoisted(() => {
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
      "ophim1.com",
    ]);
  });
});
