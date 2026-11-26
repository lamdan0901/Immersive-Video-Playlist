// @vitest-environment node

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { createPlaylistFromUrl } from "@/actions/import";
import { savePlaybackProgress } from "@/actions/playback";
import { softDeletePlaylist, updatePlaylistTitle } from "@/actions/playlists";
import { getPlaylistSummaries } from "@/db/queries/home";
import { getPlaylistDetail } from "@/db/queries/playlist";
import { openMockPlaylistDb } from "./mock-client";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("@/db/client", () => ({
  getDb: getDbMock,
  isMockPlaylistMode: () => true,
}));

it("keeps seeded playlists and CRUD changes across local database restarts", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "mock-playlists-"));
  let db: Awaited<ReturnType<typeof openMockPlaylistDb>> | undefined;
  vi.stubEnv("ADMIN_SECRET", "test-secret");

  try {
    db = await openMockPlaylistDb(dataDir);
    getDbMock.mockResolvedValue(db);
    const seeded = await getPlaylistSummaries();
    expect(seeded).toHaveLength(3);

    const created = await createPlaylistFromUrl({
      adminSecret: "test-secret",
      sourceUrl: "http://localhost:3033/api/mock-playlists/open-shorts",
    });
    if (!created.ok) throw new Error(created.error);

    const playlistId = created.data.playlistId;
    const playlist = await getPlaylistDetail(playlistId);
    const source = playlist.sources[0];
    expect(playlist.sources).toHaveLength(2);
    expect(source.episodes).toHaveLength(3);
    await savePlaybackProgress({
      playlistId,
      sourceId: source.id,
      episodeKey: source.episodes[0].episodeKey,
      seconds: 25,
    });
    expect(await updatePlaylistTitle({
      adminSecret: "test-secret",
      playlistId,
      title: "Edited playlist",
      skipStartSeconds: 5,
      version: playlist.version,
    })).toMatchObject({ ok: true });
    expect(await softDeletePlaylist({
      adminSecret: "test-secret",
      playlistId: seeded[0].id,
      version: seeded[0].version,
    })).toMatchObject({ ok: true });

    await db.$client.close();
    db = undefined;
    db = await openMockPlaylistDb(dataDir);
    getDbMock.mockResolvedValue(db);

    const reloaded = await getPlaylistSummaries();
    expect(reloaded).toHaveLength(3);
    expect(reloaded.map((item) => item.id)).not.toContain(seeded[0].id);
    expect(reloaded.find((item) => item.id === playlistId)?.title).toBe("Edited playlist");
    expect((await getPlaylistDetail(playlistId)).sources[0].episodes[0].lastPlayedSeconds).toBe(25);
  } finally {
    vi.unstubAllEnvs();
    await db?.$client.close();
    await rm(dataDir, { recursive: true, force: true });
  }
}, 30_000);
