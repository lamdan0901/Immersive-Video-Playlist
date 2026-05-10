"use server";

import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/db/client";
import { episodes, playlists, sourceSnapshots, sources, thirtyDaysFromNow } from "@/db/schema";
import { assertAdminSecret, type ActionResult } from "@/lib/admin";
import { normalizeImportedMovie } from "@/lib/importers";
import { pickDerivedImage } from "@/lib/playlist-artwork";
import { canonicalHash, matchImportedSource, preserveEpisodeIdentity, reconcileEpisodes } from "@/lib/source-refresh";
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
      lastRefreshedAt: new Date(),
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
            lastRefreshedAt: now,
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
    revalidateTag("playlists");

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
      playlistId: sources.playlistId,
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

  try {
    await performSourceRefresh({ ...sourceRow, sourceUrl });
  } catch (error) {
    const message = asErrorMessage(error);
    await updateFailedImport(input.sourceId, sourceUrl, message);
    revalidatePath(`/playlist/${input.playlistId}`);
    return { ok: false, error: message };
  }

  await logMutation("source.refresh", `Refreshed source ${sourceRow.sourceTitle}`, input.sourceId);
  revalidatePath("/");
  revalidatePath(`/playlist/${input.playlistId}`);
  revalidatePath("/trash");
  revalidateTag("playlists");

  return {
    ok: true,
    data: {
      message: `Refreshed source ${sourceRow.sourceTitle}.`
    }
  };
}

async function performSourceRefresh(
  sourceRow: {
    id: string;
    playlistId: string;
    sourceKey: string;
    sourceTitle: string;
    sortOrder: number;
    sourceUrl: string;
  },
  sourceUrlOverride?: string
) {
  const sourceUrl = sourceUrlOverride?.trim() || sourceRow.sourceUrl;
  const importedJson = await fetchSourceJson(sourceUrl);
  const importedMovie = normalizeImportedMovie(importedJson, sourceUrl);
  const importedSource = matchImportedSource(sourceRow, importedMovie.sources);

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
        lastRefreshedAt: now,
        metadata: importedSource as unknown as Record<string, unknown>,
        updatedAt: now,
        deletedAt: null,
        purgeAfter: null,
        version: sql<number>`${sources.version} + 1`
      })
      .where(and(eq(sources.id, sourceRow.id), eq(sources.playlistId, sourceRow.playlistId)));

    const existingEpisodes = await tx
      .select({
        episodeKey: episodes.episodeKey,
        title: episodes.title,
        slug: episodes.slug,
        filename: episodes.filename,
        sortOrder: episodes.sortOrder,
        deletedAt: episodes.deletedAt
      })
      .from(episodes)
      .where(eq(episodes.sourceId, sourceRow.id));

    const normalizedEpisodes = preserveEpisodeIdentity(existingEpisodes, importedSource.episodes);
    const result = reconcileEpisodes(existingEpisodes, normalizedEpisodes);

    if (result.upserts.length > 0) {
      await tx
        .insert(episodes)
        .values(
          result.upserts.map((episode) => ({
            sourceId: sourceRow.id,
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
            eq(episodes.sourceId, sourceRow.id),
            inArray(episodes.episodeKey, result.softDeletes),
            isNull(episodes.deletedAt)
          )
        );
    }

    await writeSnapshot(tx, sourceRow.id, importedSource);
  });
}

export async function autoRefreshPlaylist(playlistId?: string) {
  const threshold = sql<Date>`now() - interval '4 hours'`;

  const conditions = [
    isNull(sources.deletedAt),
    or(isNull(sources.lastRefreshedAt), lt(sources.lastRefreshedAt, threshold))
  ];

  if (playlistId) {
    conditions.push(eq(sources.playlistId, playlistId));
  }

  let query = db
    .select({
      id: sources.id,
      playlistId: sources.playlistId,
      sourceKey: sources.sourceKey,
      sourceTitle: sources.sourceTitle,
      sortOrder: sources.sortOrder,
      sourceUrl: sources.sourceUrl
    })
    .from(sources)
    .where(and(...conditions))
    .orderBy(asc(sources.lastRefreshedAt));

  if (!playlistId) {
    query = query.limit(5) as typeof query;
  }

  const staleSources = await query;

  let refreshedCount = 0;
  for (const sourceRow of staleSources) {
    try {
      await performSourceRefresh(sourceRow);
      refreshedCount++;
    } catch (error) {
      const message = asErrorMessage(error);
      await updateFailedImport(sourceRow.id, sourceRow.sourceUrl, message);
    }
  }

  if (refreshedCount > 0) {
    revalidatePath("/");
    if (playlistId) {
      revalidatePath(`/playlist/${playlistId}`);
    }
    revalidatePath("/trash");
    revalidateTag("playlists");
  }
}

export { fetchSourceJson };
