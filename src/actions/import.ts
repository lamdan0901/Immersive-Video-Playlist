"use server";

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { episodes, playlists, sourceSnapshots, sources, thirtyDaysFromNow } from "@/db/schema";
import { assertAdminSecret, type ActionResult } from "@/lib/admin";
import { normalizeImportedMovie } from "@/lib/importers";
import { canonicalHash, matchImportedSource, reconcileEpisodes } from "@/lib/source-refresh";
import type { ImportedSource } from "@/lib/types";
import { logMutation } from "./playlists";

type RefreshSuccess = { message: string };
type CreatePlaylistSuccess = { message: string; playlistId: string };
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function asErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Import failed";
}

function pickDerivedImage(source: { posterUrl: string | null; imageUrl: string | null }) {
  return source.posterUrl ?? source.imageUrl;
}

async function fetchSourceJson(url: string) {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Import request failed with ${response.status}`);
  }

  return response.json();
}

async function writeSnapshot(tx: DbTransaction, sourceId: string, importedSource: ImportedSource) {
  const hash = canonicalHash(importedSource);

  await tx
    .insert(sourceSnapshots)
    .values({
      sourceId,
      canonicalHash: hash,
      payload: importedSource as unknown as Record<string, unknown>
    })
    .onConflictDoNothing({ target: [sourceSnapshots.sourceId, sourceSnapshots.canonicalHash] });

  const snapshotRows = await tx
    .select({ id: sourceSnapshots.id })
    .from(sourceSnapshots)
    .where(eq(sourceSnapshots.sourceId, sourceId))
    .orderBy(desc(sourceSnapshots.createdAt), desc(sourceSnapshots.id));

  const staleIds = snapshotRows.slice(10).map((snapshot) => snapshot.id);
  if (staleIds.length > 0) {
    await tx.delete(sourceSnapshots).where(inArray(sourceSnapshots.id, staleIds));
  }
}

async function updateFailedImport(sourceId: string, sourceUrl: string, message: string) {
  await db
    .update(sources)
    .set({
      sourceUrl,
      importError: message,
      updatedAt: new Date(),
      version: sql<number>`${sources.version} + 1`
    })
    .where(eq(sources.id, sourceId));
}

export async function createPlaylistFromUrl(input: {
  adminSecret: string;
  sourceUrl: string;
}): Promise<ActionResult<CreatePlaylistSuccess>> {
  const auth = assertAdminSecret(input.adminSecret);
  if (!auth.ok) return auth;

  const sourceUrl = input.sourceUrl.trim();
  if (!sourceUrl) {
    return { ok: false, error: "Source URL is required before import." };
  }

  try {
    const importedJson = await fetchSourceJson(sourceUrl);
    const importedMovie = normalizeImportedMovie(importedJson, sourceUrl);

    if (importedMovie.sources.length === 0) {
      return { ok: false, error: "Imported payload does not contain any sources." };
    }

    const now = new Date();
    const playlistId = await db.transaction(async (tx) => {
      const insertedPlaylists = await tx
        .insert(playlists)
        .values({
          title: importedMovie.title,
          slug: importedMovie.slug,
          derivedImageUrl: pickDerivedImage(importedMovie),
          metadata: importedMovie.metadata,
          updatedAt: now
        })
        .returning({ id: playlists.id });

      const playlistId = insertedPlaylists[0]?.id;
      if (!playlistId) {
        throw new Error("Playlist import failed");
      }

      for (const [index, importedSource] of importedMovie.sources.entries()) {
        const insertedSources = await tx
          .insert(sources)
          .values({
            playlistId,
            sourceKey: importedSource.sourceKey,
            sourceTitle: importedSource.sourceTitle,
            sourceUrl: importedSource.sourceUrl,
            preferredLinkType: importedSource.preferredLinkType,
            sortOrder: index,
            importError: null,
            metadata: importedSource as unknown as Record<string, unknown>,
            updatedAt: now
          })
          .returning({ id: sources.id });

        const sourceId = insertedSources[0]?.id;
        if (!sourceId) {
          throw new Error(`Failed to insert source ${importedSource.sourceKey}`);
        }

        if (importedSource.episodes.length > 0) {
          await tx.insert(episodes).values(
            importedSource.episodes.map((episode, episodeIndex) => ({
              sourceId,
              episodeKey: episode.episodeKey,
              title: episode.title,
              slug: episode.slug,
              filename: episode.filename,
              embedUrl: episode.embedUrl,
              m3u8Url: episode.m3u8Url,
              sortOrder: episodeIndex
            }))
          );
        }

        await writeSnapshot(tx, sourceId, importedSource);
      }

      return playlistId;
    });

    await logMutation("playlist.create", `Imported playlist ${importedMovie.title}`, playlistId);
    revalidatePath("/");
    revalidatePath(`/playlist/${playlistId}`);

    return {
      ok: true,
      data: {
        playlistId,
        message: `Imported playlist ${importedMovie.title}.`
      }
    };
  } catch (error) {
    return { ok: false, error: asErrorMessage(error) };
  }
}

export async function refreshSource(input: {
  adminSecret: string;
  playlistId: string;
  sourceId: string;
  sourceUrl: string;
}): Promise<ActionResult<RefreshSuccess>> {
  const auth = assertAdminSecret(input.adminSecret);
  if (!auth.ok) return auth;

  const sourceUrl = input.sourceUrl.trim();
  if (!sourceUrl) {
    return { ok: false, error: "Source URL is required before refresh." };
  }

  const sourceRows = await db
    .select({
      id: sources.id,
      sourceKey: sources.sourceKey,
      sourceTitle: sources.sourceTitle,
      sortOrder: sources.sortOrder
    })
    .from(sources)
    .where(and(eq(sources.id, input.sourceId), eq(sources.playlistId, input.playlistId), isNull(sources.deletedAt)));

  const sourceRow = sourceRows[0];
  if (!sourceRow) {
    return { ok: false, error: "Source not found." };
  }

  let importedSource: ImportedSource;

  try {
    const importedJson = await fetchSourceJson(sourceUrl);
    const importedMovie = normalizeImportedMovie(importedJson, sourceUrl);
    importedSource = matchImportedSource(sourceRow, importedMovie.sources);
  } catch (error) {
    const message = asErrorMessage(error);
    await updateFailedImport(input.sourceId, sourceUrl, message);
    revalidatePath(`/playlist/${input.playlistId}`);
    return { ok: false, error: message };
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(sources)
      .set({
        sourceKey: importedSource.sourceKey,
        sourceTitle: importedSource.sourceTitle,
        sourceUrl,
        preferredLinkType: importedSource.preferredLinkType,
        importError: null,
        metadata: importedSource as unknown as Record<string, unknown>,
        updatedAt: now,
        deletedAt: null,
        purgeAfter: null,
        version: sql<number>`${sources.version} + 1`
      })
      .where(and(eq(sources.id, input.sourceId), eq(sources.playlistId, input.playlistId)));

    const existingEpisodes = await tx
      .select({
        episodeKey: episodes.episodeKey,
        sortOrder: episodes.sortOrder,
        deletedAt: episodes.deletedAt
      })
      .from(episodes)
      .where(eq(episodes.sourceId, input.sourceId));

    const result = reconcileEpisodes(existingEpisodes, importedSource.episodes);

    if (result.upserts.length > 0) {
      await tx
        .insert(episodes)
        .values(
          result.upserts.map((episode) => ({
            sourceId: input.sourceId,
            episodeKey: episode.episodeKey,
            title: episode.title,
            slug: episode.slug,
            filename: episode.filename,
            embedUrl: episode.embedUrl,
            m3u8Url: episode.m3u8Url,
            sortOrder: episode.sortOrder,
            updatedAt: now,
            deletedAt: null,
            purgeAfter: null
          }))
        )
        .onConflictDoUpdate({
          target: [episodes.sourceId, episodes.episodeKey],
          set: {
            title: sql`excluded.title`,
            slug: sql`excluded.slug`,
            filename: sql`excluded.filename`,
            embedUrl: sql`excluded.embed_url`,
            m3u8Url: sql`excluded.m3u8_url`,
            sortOrder: sql`excluded.sort_order`,
            deletedAt: null,
            purgeAfter: null,
            updatedAt: now,
            version: sql<number>`${episodes.version} + 1`
          }
        });
    }

    if (result.softDeletes.length > 0) {
      await tx
        .update(episodes)
        .set({
          deletedAt: now,
          purgeAfter: thirtyDaysFromNow,
          updatedAt: now,
          version: sql<number>`${episodes.version} + 1`
        })
        .where(
          and(
            eq(episodes.sourceId, input.sourceId),
            inArray(episodes.episodeKey, result.softDeletes),
            isNull(episodes.deletedAt)
          )
        );
    }

    await writeSnapshot(tx, input.sourceId, importedSource);
  });

  await logMutation("source.refresh", `Refreshed source ${importedSource.sourceTitle}`, input.sourceId);
  revalidatePath("/");
  revalidatePath(`/playlist/${input.playlistId}`);
  revalidatePath("/trash");

  return {
    ok: true,
    data: {
      message: `Refreshed source ${importedSource.sourceTitle}.`
    }
  };
}

export { fetchSourceJson };
