"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { mutationLogs, playlists, sources, thirtyDaysFromNow } from "@/db/schema";
import { assertAdminSecret, type ActionResult } from "@/lib/admin";
import type { LinkType } from "@/lib/types";

function normalizeSourceKey(value: string) {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || "source";
}

function conflict<T = void>(message: string): ActionResult<T> {
  return { ok: false, error: message, conflict: true };
}

export async function logMutation(kind: typeof mutationLogs.$inferInsert.kind, summary: string, entityId?: string) {
  await db.insert(mutationLogs).values({ kind, summary, entityId });
}

export async function verifyWrite(secret: string): Promise<ActionResult> {
  return assertAdminSecret(secret);
}

export async function updatePlaylistTitle(input: {
  adminSecret: string;
  playlistId: string;
  title: string;
  skipStartSeconds: number;
  version: number;
}): Promise<ActionResult> {
  const auth = assertAdminSecret(input.adminSecret);
  if (!auth.ok) return auth;

  const nextTitle = input.title.trim() || "Untitled Playlist";
  const nextSkipStartSeconds = Math.max(0, Math.floor(input.skipStartSeconds));
  const result = await db
    .update(playlists)
    .set({
      title: nextTitle,
      metadata: sql<Record<string, unknown>>`jsonb_set(coalesce(${playlists.metadata}, '{}'::jsonb), '{skipStartSeconds}', to_jsonb(${nextSkipStartSeconds}), true)`,
      version: input.version + 1,
      updatedAt: new Date()
    })
    .where(and(eq(playlists.id, input.playlistId), eq(playlists.version, input.version), isNull(playlists.deletedAt)))
    .returning({ id: playlists.id });

  if (result.length === 0) {
    return conflict("This playlist changed. Refresh before saving.");
  }

  await logMutation("playlist.update", `Updated playlist settings for ${nextTitle}`, input.playlistId);
  revalidatePath("/");
  revalidatePath(`/playlist/${input.playlistId}`);
  return { ok: true, data: undefined };
}

export async function softDeletePlaylist(input: {
  adminSecret: string;
  playlistId: string;
  version: number;
}): Promise<ActionResult> {
  const auth = assertAdminSecret(input.adminSecret);
  if (!auth.ok) return auth;

  const result = await db
    .update(playlists)
    .set({
      deletedAt: new Date(),
      purgeAfter: thirtyDaysFromNow,
      version: input.version + 1,
      updatedAt: new Date()
    })
    .where(and(eq(playlists.id, input.playlistId), eq(playlists.version, input.version), isNull(playlists.deletedAt)))
    .returning({ id: playlists.id });

  if (result.length === 0) {
    return conflict("This playlist changed. Refresh before deleting it.");
  }

  await logMutation("playlist.delete", "Moved playlist to trash", input.playlistId);
  revalidatePath("/");
  revalidatePath(`/playlist/${input.playlistId}`);
  revalidatePath("/trash");
  return { ok: true, data: undefined };
}

export async function updateSource(input: {
  adminSecret: string;
  playlistId: string;
  sourceId: string;
  sourceTitle: string;
  sourceUrl: string;
  preferredLinkType: LinkType;
  version: number;
}): Promise<ActionResult> {
  const auth = assertAdminSecret(input.adminSecret);
  if (!auth.ok) return auth;

  const nextTitle = input.sourceTitle.trim() || "New Source";
  const nextUrl = input.sourceUrl.trim();
  const result = await db
    .update(sources)
    .set({
      sourceTitle: nextTitle,
      sourceUrl: nextUrl,
      preferredLinkType: input.preferredLinkType,
      version: input.version + 1,
      updatedAt: new Date()
    })
    .where(
      and(
        eq(sources.id, input.sourceId),
        eq(sources.playlistId, input.playlistId),
        eq(sources.version, input.version),
        isNull(sources.deletedAt)
      )
    )
    .returning({ id: sources.id });

  if (result.length === 0) {
    return conflict("This source changed. Refresh before saving.");
  }

  await logMutation("source.update", `Updated source ${nextTitle}`, input.sourceId);
  revalidatePath("/");
  revalidatePath(`/playlist/${input.playlistId}`);
  return { ok: true, data: undefined };
}

export async function createBlankSource(input: {
  adminSecret: string;
  playlistId: string;
  playlistVersion: number;
  sourceTitle?: string;
  sourceUrl?: string;
  preferredLinkType?: LinkType;
}): Promise<ActionResult<{ sourceId: string }>> {
  const auth = assertAdminSecret(input.adminSecret);
  if (!auth.ok) return auth;

  const nextTitle = input.sourceTitle?.trim() || "New Source";
  const nextUrl = input.sourceUrl?.trim() ?? "";
  const nextLinkType = input.preferredLinkType ?? "embed";

  const result = await db.transaction(async (tx) => {
    const playlistResult = await tx
      .update(playlists)
      .set({
        version: input.playlistVersion + 1,
        updatedAt: new Date()
      })
      .where(and(eq(playlists.id, input.playlistId), eq(playlists.version, input.playlistVersion), isNull(playlists.deletedAt)))
      .returning({ id: playlists.id });

    if (playlistResult.length === 0) {
      return null;
    }

    const inserted = await tx
      .insert(sources)
      .values({
        playlistId: input.playlistId,
        sourceKey: `${Date.now()}-${normalizeSourceKey(nextTitle)}`,
        sourceTitle: nextTitle,
        sourceUrl: nextUrl,
        preferredLinkType: nextLinkType,
        sortOrder: sql<number>`(
          select coalesce(max(${sources.sortOrder}), -1) + 1
          from ${sources}
          where ${sources.playlistId} = ${input.playlistId}
            and ${sources.deletedAt} is null
        )`
      })
      .returning({ id: sources.id });

    return inserted[0] ?? null;
  });

  if (!result) {
    return conflict<{ sourceId: string }>("This playlist changed. Refresh before creating a source.");
  }

  await logMutation("source.create", `Created source ${nextTitle}`, result.id);
  revalidatePath("/");
  revalidatePath(`/playlist/${input.playlistId}`);
  return { ok: true, data: { sourceId: result.id } };
}

export async function softDeleteSource(input: {
  adminSecret: string;
  playlistId: string;
  playlistVersion: number;
  sourceId: string;
  sourceVersion: number;
}): Promise<ActionResult> {
  const auth = assertAdminSecret(input.adminSecret);
  if (!auth.ok) return auth;

  const deleted = await db.transaction(async (tx) => {
    const playlistResult = await tx
      .update(playlists)
      .set({
        version: input.playlistVersion + 1,
        updatedAt: new Date()
      })
      .where(and(eq(playlists.id, input.playlistId), eq(playlists.version, input.playlistVersion), isNull(playlists.deletedAt)))
      .returning({ id: playlists.id });

    if (playlistResult.length === 0) {
      return { kind: "playlist" as const };
    }

    const sourceResult = await tx
      .update(sources)
      .set({
        deletedAt: new Date(),
        purgeAfter: thirtyDaysFromNow,
        version: input.sourceVersion + 1,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(sources.id, input.sourceId),
          eq(sources.playlistId, input.playlistId),
          eq(sources.version, input.sourceVersion),
          isNull(sources.deletedAt)
        )
      )
      .returning({ id: sources.id });

    if (sourceResult.length === 0) {
      throw new Error("SOURCE_CONFLICT");
    }

    return { kind: "source" as const, id: sourceResult[0].id };
  }).catch((error: unknown) => {
    if (error instanceof Error && error.message === "SOURCE_CONFLICT") {
      return { kind: "source-conflict" as const };
    }

    throw error;
  });

  if (deleted.kind === "playlist") {
    return conflict("This playlist changed. Refresh before deleting a source.");
  }

  if (deleted.kind === "source-conflict") {
    return conflict("This source changed. Refresh before deleting it.");
  }

  await logMutation("source.delete", "Moved source to trash", deleted.id);
  revalidatePath("/");
  revalidatePath(`/playlist/${input.playlistId}`);
  revalidatePath("/trash");
  return { ok: true, data: undefined };
}
