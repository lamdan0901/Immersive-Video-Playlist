"use server";

import { and, asc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import { playlistGroupMembers, playlistGroups, playlists } from "@/db/schema";
import { assertAdminSecret, type ActionResult } from "@/lib/admin";

const groupIdentity = z.object({ id: z.uuid(), version: z.number().int().positive() });
const saveGroupInput = z.object({
  adminSecret: z.string(),
  group: groupIdentity.optional(),
  name: z.string().trim().max(200),
  note: z.string().trim().max(4000),
  playlistIds: z.array(z.uuid()).min(1).refine((ids) => new Set(ids).size === ids.length),
});
const removeGroupInput = z.object({ adminSecret: z.string(), group: groupIdentity });
const staleGroup = "This group changed. Reopen it before editing.";

class GroupConflict extends Error {}

export async function savePlaylistGroup(input: z.input<typeof saveGroupInput>): Promise<ActionResult> {
  const parsed = saveGroupInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter valid group details and select at least one playlist." };
  const { adminSecret, group, name, note, playlistIds } = parsed.data;
  const auth = assertAdminSecret(adminSecret);
  if (!auth.ok) return auth;

  const db = await getDb();
  try {
    await db.transaction(async (tx) => {
      const [saved] = group
        ? await tx.update(playlistGroups)
            .set({ name, note, version: group.version + 1 })
            .where(and(eq(playlistGroups.id, group.id), eq(playlistGroups.version, group.version)))
            .returning({ id: playlistGroups.id })
        : await tx.insert(playlistGroups).values({ name, note }).returning({ id: playlistGroups.id });
      if (!saved) throw new GroupConflict(staleGroup);

      const currentMembers = tx.select({ id: playlistGroupMembers.playlistId }).from(playlistGroupMembers)
        .where(eq(playlistGroupMembers.groupId, saved.id));
      const affected = await tx.select({ id: playlists.id, deletedAt: playlists.deletedAt }).from(playlists)
        .where(or(inArray(playlists.id, playlistIds), inArray(playlists.id, currentMembers)))
        .orderBy(asc(playlists.id)).for("update");
      const activeIds = new Set(affected.filter((playlist) => !playlist.deletedAt).map((playlist) => playlist.id));
      if (!playlistIds.every((id) => activeIds.has(id))) {
        throw new GroupConflict("A selected playlist is no longer available. Reopen the group and try again.");
      }

      // Keep trashed members in order so they can reappear when restored.
      const trashed = group ? await tx.select({ id: playlistGroupMembers.playlistId })
        .from(playlistGroupMembers).innerJoin(playlists, eq(playlists.id, playlistGroupMembers.playlistId))
        .where(and(eq(playlistGroupMembers.groupId, group.id), isNotNull(playlists.deletedAt)))
        .orderBy(asc(playlistGroupMembers.sortOrder)) : [];
      if (group) await tx.delete(playlistGroupMembers).where(eq(playlistGroupMembers.groupId, group.id));

      const orderedIds = [...playlistIds, ...trashed.map(({ id }) => id)];
      const added = await tx.insert(playlistGroupMembers)
        .values(orderedIds.map((playlistId, sortOrder) => ({ playlistId, groupId: saved.id, sortOrder })))
        .onConflictDoNothing({ target: playlistGroupMembers.playlistId })
        .returning({ id: playlistGroupMembers.playlistId });
      if (added.length !== orderedIds.length) {
        throw new GroupConflict("A selected playlist is already in another group. Reopen the editor and try again.");
      }
    });
  } catch (error) {
    if (error instanceof GroupConflict) return { ok: false, error: error.message, conflict: true };
    throw error;
  }

  revalidatePath("/");
  return { ok: true, data: undefined };
}

export async function removePlaylistGroup(input: z.input<typeof removeGroupInput>): Promise<ActionResult> {
  const parsed = removeGroupInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid playlist group." };
  const { adminSecret, group } = parsed.data;
  const auth = assertAdminSecret(adminSecret);
  if (!auth.ok) return auth;

  const db = await getDb();
  const [removed] = await db.delete(playlistGroups)
    .where(and(eq(playlistGroups.id, group.id), eq(playlistGroups.version, group.version)))
    .returning({ id: playlistGroups.id });
  if (!removed) return { ok: false, error: staleGroup, conflict: true };

  revalidatePath("/");
  return { ok: true, data: undefined };
}
