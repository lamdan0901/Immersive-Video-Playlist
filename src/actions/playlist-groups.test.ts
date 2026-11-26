// @vitest-environment node

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { expect, it, vi } from "vitest";
import { getPlaylistGroups } from "@/db/queries/playlist-groups";
import * as schema from "@/db/schema";
import { removePlaylistGroup, savePlaylistGroup } from "./playlist-groups";

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("@/db/client", () => ({ getDb }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

it("persists shared groups atomically and ungrouping preserves the playlists", async () => {
  const client = await PGlite.create();
  const db = drizzle({ client, schema });
  getDb.mockResolvedValue(db);
  vi.stubEnv("ADMIN_SECRET", "group-test");

  try {
    await migrate(db, { migrationsFolder: "drizzle" });
    const [first, second, third] = await db.insert(schema.playlists)
      .values([{ title: "First" }, { title: "Second" }, { title: "Third" }])
      .returning({ id: schema.playlists.id });
    const draft = {
      adminSecret: "group-test",
      name: "",
      note: "Watch in order",
      playlistIds: [first.id, second.id],
    };

    expect(await savePlaylistGroup({ ...draft, adminSecret: "invalid" })).toMatchObject({ ok: false });
    expect(await savePlaylistGroup(draft)).toMatchObject({ ok: true });
    const [group] = await getPlaylistGroups();
    expect(group).toMatchObject({
      name: "",
      note: "Watch in order",
      members: [{ playlistId: first.id }, { playlistId: second.id }],
    });

    expect(await savePlaylistGroup({ ...draft, playlistIds: [third.id, first.id] }))
      .toMatchObject({ ok: false, conflict: true });
    expect(await getPlaylistGroups()).toEqual([group]);

    expect(await savePlaylistGroup({ ...draft, group, name: "Double feature", playlistIds: [second.id, first.id] }))
      .toMatchObject({ ok: true });
    const [edited] = await getPlaylistGroups();
    expect(edited).toMatchObject({
      name: "Double feature",
      version: group.version + 1,
      members: [{ playlistId: second.id }, { playlistId: first.id }],
    });
    expect(await removePlaylistGroup({ adminSecret: draft.adminSecret, group })).toMatchObject({ ok: false });
    expect(await removePlaylistGroup({ adminSecret: draft.adminSecret, group: edited })).toMatchObject({ ok: true });
    expect(await getPlaylistGroups()).toEqual([]);
    expect(await db.select().from(schema.playlists)).toHaveLength(3);
  } finally {
    vi.unstubAllEnvs();
    await client.close();
  }
}, 30_000);
