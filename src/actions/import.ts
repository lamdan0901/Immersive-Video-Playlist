"use server";

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/db/client";
import {
  episodes,
  playlists,
  sourceSnapshots,
  sources,
  thirtyDaysFromNow,
} from "@/db/schema";
import { assertAdminSecret, type ActionResult } from "@/lib/admin";
import {
  buildImportRequestHeaders,
  extractNguoncPayloadFromHtml,
  extractNguoncSlug,
  getNguoncRelayBaseUrl,
  isNguoncUrl,
  normalizeImportedMovie,
  resolveApiUrl,
  resolveNguoncPageUrl,
} from "@/lib/importers";
import { pickDerivedImage } from "@/lib/playlist-artwork";
import {
  canonicalHash,
  matchImportedSource,
  preserveEpisodeIdentity,
  reconcileEpisodes,
} from "@/lib/source-refresh";
import type { ImportedSource } from "@/lib/types";
import { logMutation } from "./playlists";

type RefreshSuccess = { message: string };
type RefreshPlaylistSourcesSuccess = {
  message: string;
  refreshedCount: number;
  failedCount: number;
};
type CreatePlaylistSuccess = { message: string; playlistId: string };
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const AUTO_REFRESH_DELAY_MS = 3000;

function asErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Import failed";
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function createAbortError() {
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
}

async function sleep(ms: number, signal?: AbortSignal) {
  if (ms <= 0) {
    return;
  }

  if (signal?.aborted) {
    throw createAbortError();
  }

  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, ms);

    function handleAbort() {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", handleAbort);
      reject(createAbortError());
    }

    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}

function sourceTitleFromUrl(sourceUrl: string) {
  try {
    return new URL(sourceUrl).hostname;
  } catch {
    return "New Source";
  }
}

function shouldDisableAutoRefresh(sourceUrl: string) {
  return isNguoncUrl(sourceUrl);
}

function sourceCountLabel(count: number) {
  return `${count} source${count === 1 ? "" : "s"}`;
}

function refreshPlaylistSourcesMessage(
  refreshedCount: number,
  failedCount: number,
) {
  if (failedCount === 0) {
    return `Refreshed ${sourceCountLabel(refreshedCount)}.`;
  }

  if (refreshedCount === 0) {
    return `Failed to refresh ${sourceCountLabel(failedCount)}.`;
  }

  return `Refreshed ${sourceCountLabel(refreshedCount)}; ${failedCount} failed.`;
}

function resolveNguoncRelayFetchUrl(sourceUrl: string): string {
  if (!isNguoncUrl(sourceUrl)) {
    return sourceUrl;
  }

  const relayBaseUrl = getNguoncRelayBaseUrl();
  const slug = extractNguoncSlug(sourceUrl);

  if (!relayBaseUrl || !slug) {
    console.log(
      "[resolveNguoncRelayFetchUrl] Relay not configured:",
      JSON.stringify({ relayBaseUrl: !!relayBaseUrl, slug: !!slug }),
    );
    return sourceUrl;
  }

  const relayUrl = `${relayBaseUrl.replace(/\/+$/, "")}/${slug}`;
  console.log("[resolveNguoncRelayFetchUrl] Using relay:", relayUrl);
  return relayUrl;
}

async function createPlaylistFromImportedJsonInternal(
  sourceUrl: string,
  importedJson: unknown,
): Promise<ActionResult<CreatePlaylistSuccess>> {
  const importedMovie = normalizeImportedMovie(importedJson, sourceUrl);

  if (importedMovie.sources.length === 0) {
    return {
      ok: false,
      error: "Imported payload does not contain any sources.",
    };
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
        autoRefreshDisabled: shouldDisableAutoRefresh(sourceUrl),
        updatedAt: now,
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
          sourceTitle: sourceTitleFromUrl(sourceUrl),
          sourceUrl: importedSource.sourceUrl,
          preferredLinkType: importedSource.preferredLinkType,
          sortOrder: index,
          importError: null,
          lastRefreshedAt: now,
          metadata: importedSource as unknown as Record<string, unknown>,
          updatedAt: now,
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
            sortOrder: episodeIndex,
          })),
        );
      }

      await writeSnapshot(tx, sourceId, importedSource);
    }

    return playlistId;
  });

  await logMutation(
    "playlist.create",
    `Imported playlist ${importedMovie.title}`,
    playlistId,
  );
  revalidatePath("/");
  revalidatePath(`/playlist/${playlistId}`);
  revalidateTag("playlists");

  return {
    ok: true,
    data: {
      playlistId,
      message: `Imported playlist ${importedMovie.title}.`,
    },
  };
}

async function fetchSourceJson(url: string, signal?: AbortSignal) {
  const fetchUrl = resolveNguoncRelayFetchUrl(url);
  if (fetchUrl !== url) {
    console.log("[fetchSourceJson] Fetching via relay:", fetchUrl);
  } else {
    console.log("[fetchSourceJson] Fetching directly (no relay):", url);
  }
  const response = await fetch(fetchUrl, {
    cache: "no-store",
    headers:
      fetchUrl === url
        ? buildImportRequestHeaders(url, "application/json,text/plain,*/*")
        : undefined,
    signal,
  });

  if (!response.ok) {
    console.warn("[fetchSourceJson] Primary fetch failed", {
      requestedUrl: url,
      fetchUrl,
      status: response.status,
    });

    const fallbackPageUrl = resolveNguoncPageUrl(url);
    if (fallbackPageUrl && (response.status === 403 || response.status === 429)) {
      console.log(
        "[fetchSourceJson] Trying NguonC HTML fallback:",
        fallbackPageUrl,
      );
      try {
        const pageResponse = await fetch(fallbackPageUrl, {
          cache: "no-store",
          headers: buildImportRequestHeaders(
            fallbackPageUrl,
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          ),
          signal,
        });

        if (pageResponse.ok) {
          console.log(
            "[fetchSourceJson] NguonC HTML fallback succeeded: " +
              fallbackPageUrl,
          );
          return extractNguoncPayloadFromHtml(
            await pageResponse.text(),
            fallbackPageUrl,
          );
        }

        console.warn(
          "[fetchSourceJson] NguonC HTML fallback page returned " +
            pageResponse.status +
            " for " +
            fallbackPageUrl,
        );
      } catch (fallbackError) {
        console.warn(
          "[fetchSourceJson] NguonC HTML fallback fetch error:",
          fallbackPageUrl,
          fallbackError,
        );
      }
    }

    throw new Error(`Import request failed with ${response.status}`);
  }

  return response.json();
}

async function writeSnapshot(
  tx: DbTransaction,
  sourceId: string,
  importedSource: ImportedSource,
) {
  const hash = canonicalHash(importedSource);

  await tx
    .insert(sourceSnapshots)
    .values({
      sourceId,
      canonicalHash: hash,
      payload: importedSource as unknown as Record<string, unknown>,
    })
    .onConflictDoNothing({
      target: [sourceSnapshots.sourceId, sourceSnapshots.canonicalHash],
    });

  const snapshotRows = await tx
    .select({ id: sourceSnapshots.id })
    .from(sourceSnapshots)
    .where(eq(sourceSnapshots.sourceId, sourceId))
    .orderBy(desc(sourceSnapshots.createdAt), desc(sourceSnapshots.id));

  const staleIds = snapshotRows.slice(10).map((snapshot) => snapshot.id);
  if (staleIds.length > 0) {
    await tx
      .delete(sourceSnapshots)
      .where(inArray(sourceSnapshots.id, staleIds));
  }
}

async function updateFailedImport(
  sourceId: string,
  sourceUrl: string,
  message: string,
) {
  await db
    .update(sources)
    .set({
      sourceUrl,
      importError: message,
      lastRefreshedAt: new Date(),
      updatedAt: new Date(),
      version: sql<number>`${sources.version} + 1`,
    })
    .where(eq(sources.id, sourceId));
}

export async function createPlaylistFromUrl(input: {
  adminSecret: string;
  sourceUrl: string;
}): Promise<ActionResult<CreatePlaylistSuccess>> {
  const auth = assertAdminSecret(input.adminSecret);
  if (!auth.ok) return auth;

  const rawUrl = input.sourceUrl.trim();
  if (!rawUrl) {
    return { ok: false, error: "Source URL is required before import." };
  }

  const sourceUrl = resolveApiUrl(rawUrl);

  try {
    return await createPlaylistFromImportedJsonInternal(
      sourceUrl,
      await fetchSourceJson(sourceUrl),
    );
  } catch (error) {
    console.error("[createPlaylistFromUrl] failed:", input.sourceUrl, error);
    return { ok: false, error: asErrorMessage(error) };
  }
}

export async function createPlaylistFromImportedJson(input: {
  adminSecret: string;
  sourceUrl: string;
  importedJson: unknown;
}): Promise<ActionResult<CreatePlaylistSuccess>> {
  const auth = assertAdminSecret(input.adminSecret);
  if (!auth.ok) return auth;

  const rawUrl = input.sourceUrl.trim();
  if (!rawUrl) {
    return { ok: false, error: "Source URL is required before import." };
  }

  const sourceUrl = resolveApiUrl(rawUrl);

  try {
    return await createPlaylistFromImportedJsonInternal(
      sourceUrl,
      input.importedJson,
    );
  } catch (error) {
    console.error(
      "[createPlaylistFromImportedJson] failed:",
      input.sourceUrl,
      error,
    );
    return { ok: false, error: asErrorMessage(error) };
  }
}

export async function createSourceFromUrl(input: {
  adminSecret: string;
  playlistId: string;
  playlistVersion: number;
  sourceUrl: string;
}): Promise<ActionResult<{ message: string }>> {
  const auth = assertAdminSecret(input.adminSecret);
  if (!auth.ok) return auth;

  const rawUrl = input.sourceUrl.trim();
  if (!rawUrl) {
    return { ok: false, error: "Source URL is required." };
  }

  const sourceUrl = resolveApiUrl(rawUrl);

  try {
    const importedJson = await fetchSourceJson(sourceUrl);
    const importedMovie = normalizeImportedMovie(importedJson, sourceUrl);

    if (importedMovie.sources.length === 0) {
      return {
        ok: false,
        error: "Imported payload does not contain any sources.",
      };
    }

    const now = new Date();
    const createdSourceTitle = sourceTitleFromUrl(sourceUrl);
    const created = await db.transaction(async (tx) => {
      const playlistResult = await tx
        .update(playlists)
        .set({ version: input.playlistVersion + 1, updatedAt: now })
        .where(
          and(
            eq(playlists.id, input.playlistId),
            eq(playlists.version, input.playlistVersion),
            isNull(playlists.deletedAt),
          ),
        )
        .returning({ id: playlists.id });

      if (playlistResult.length === 0) {
        return null;
      }

      const maxSortResult = await tx
        .select({
          maxOrder: sql<number>`coalesce(max(${sources.sortOrder}), -1)`,
        })
        .from(sources)
        .where(
          and(
            eq(sources.playlistId, input.playlistId),
            isNull(sources.deletedAt),
          ),
        );
      let nextSortOrder = (maxSortResult[0]?.maxOrder ?? -1) + 1;

      const createdSources: { id: string; title: string }[] = [];
      for (const importedSource of importedMovie.sources) {
        const uniqueSourceKey = `${importedSource.sourceKey}-${Date.now()}`;
        const inserted = await tx
          .insert(sources)
          .values({
            playlistId: input.playlistId,
            sourceKey: uniqueSourceKey,
            sourceTitle: createdSourceTitle,
            sourceUrl: importedSource.sourceUrl,
            preferredLinkType: importedSource.preferredLinkType,
            sortOrder: nextSortOrder++,
            importError: null,
            lastRefreshedAt: now,
            metadata: importedSource as unknown as Record<string, unknown>,
            updatedAt: now,
          })
          .returning({ id: sources.id });

        const sourceId = inserted[0]?.id;
        if (!sourceId) {
          throw new Error(
            `Failed to insert source ${importedSource.sourceKey}`,
          );
        }

        if (importedSource.episodes.length > 0) {
          await tx.insert(episodes).values(
            importedSource.episodes.map((episode, index) => ({
              sourceId,
              episodeKey: episode.episodeKey,
              title: episode.title,
              slug: episode.slug,
              filename: episode.filename,
              embedUrl: episode.embedUrl,
              m3u8Url: episode.m3u8Url,
              sortOrder: index,
            })),
          );
        }

        await writeSnapshot(tx, sourceId, importedSource);
        createdSources.push({
          id: sourceId,
          title: createdSourceTitle,
        });
      }

      return createdSources;
    });

    if (!created) {
      return {
        ok: false,
        error: "This playlist changed. Refresh before creating a source.",
      };
    }

    const summary =
      created.length === 1
        ? `Created source "${created[0].title}" from URL.`
        : `Created ${created.length} sources from URL.`;

    await logMutation("source.create", summary, input.playlistId);
    revalidatePath("/");
    revalidatePath(`/playlist/${input.playlistId}`);
    revalidateTag("playlists");

    return { ok: true, data: { message: summary } };
  } catch (error) {
    console.error("[createSourceFromUrl] failed:", input.sourceUrl, error);
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

  const rawUrl = input.sourceUrl.trim();
  if (!rawUrl) {
    return { ok: false, error: "Source URL is required before refresh." };
  }

  const sourceUrl = resolveApiUrl(rawUrl);

  const sourceRows = await db
    .select({
      id: sources.id,
      playlistId: sources.playlistId,
      sourceKey: sources.sourceKey,
      sourceTitle: sources.sourceTitle,
      sortOrder: sources.sortOrder,
    })
    .from(sources)
    .where(
      and(
        eq(sources.id, input.sourceId),
        eq(sources.playlistId, input.playlistId),
        isNull(sources.deletedAt),
      ),
    );

  const sourceRow = sourceRows[0];
  if (!sourceRow) {
    return { ok: false, error: "Source not found." };
  }

  try {
    await performSourceRefresh({ ...sourceRow, sourceUrl });
  } catch (error) {
    console.error("[refreshSource] failed:", sourceUrl, error);
    const message = asErrorMessage(error);
    await updateFailedImport(input.sourceId, sourceUrl, message);
    revalidatePath(`/playlist/${input.playlistId}`);
    return { ok: false, error: message };
  }

  await logMutation(
    "source.refresh",
    `Refreshed source ${sourceRow.sourceTitle}`,
    input.sourceId,
  );
  revalidatePath("/");
  revalidatePath(`/playlist/${input.playlistId}`);
  revalidatePath("/trash");
  revalidateTag("playlists");

  return {
    ok: true,
    data: {
      message: `Refreshed source ${sourceRow.sourceTitle}.`,
    },
  };
}

export async function refreshPlaylistSources(input: {
  adminSecret: string;
  playlistId: string;
}): Promise<ActionResult<RefreshPlaylistSourcesSuccess>> {
  const auth = assertAdminSecret(input.adminSecret);
  if (!auth.ok) return auth;

  const sourceRows = await db
    .select({
      id: sources.id,
      playlistId: sources.playlistId,
      sourceKey: sources.sourceKey,
      sourceTitle: sources.sourceTitle,
      sortOrder: sources.sortOrder,
      sourceUrl: sources.sourceUrl,
    })
    .from(sources)
    .where(
      and(eq(sources.playlistId, input.playlistId), isNull(sources.deletedAt)),
    )
    .orderBy(asc(sources.sortOrder));

  if (sourceRows.length === 0) {
    return { ok: false, error: "No sources to refresh." };
  }

  let refreshedCount = 0;
  let failedCount = 0;

  for (const sourceRow of sourceRows) {
    try {
      await performSourceRefresh(sourceRow);
      refreshedCount++;
    } catch (error) {
      console.error(
        "[refreshPlaylistSources] failed:",
        sourceRow.sourceUrl,
        error,
      );
      failedCount++;
      await updateFailedImport(
        sourceRow.id,
        sourceRow.sourceUrl,
        asErrorMessage(error),
      );
    }
  }

  const message = refreshPlaylistSourcesMessage(refreshedCount, failedCount);

  await logMutation("source.refresh", message, input.playlistId);
  revalidatePath("/");
  revalidatePath(`/playlist/${input.playlistId}`);
  revalidatePath("/trash");
  revalidateTag("playlists");

  if (failedCount > 0) {
    return { ok: false, error: message };
  }

  return {
    ok: true,
    data: {
      message,
      refreshedCount,
      failedCount,
    },
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
  sourceUrlOverride?: string,
  signal?: AbortSignal,
) {
  const sourceUrl = sourceUrlOverride?.trim() || sourceRow.sourceUrl;
  const importedJson = await fetchSourceJson(sourceUrl, signal);
  const importedMovie = normalizeImportedMovie(importedJson, sourceUrl);
  const importedSource = matchImportedSource(sourceRow, importedMovie.sources);

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(sources)
      .set({
        sourceTitle: sourceTitleFromUrl(sourceUrl),
        sourceUrl,
        preferredLinkType: importedSource.preferredLinkType,
        importError: null,
        lastRefreshedAt: now,
        metadata: importedSource as unknown as Record<string, unknown>,
        updatedAt: now,
        deletedAt: null,
        purgeAfter: null,
        version: sql<number>`${sources.version} + 1`,
      })
      .where(
        and(
          eq(sources.id, sourceRow.id),
          eq(sources.playlistId, sourceRow.playlistId),
        ),
      );

    const existingEpisodes = await tx
      .select({
        episodeKey: episodes.episodeKey,
        title: episodes.title,
        slug: episodes.slug,
        filename: episodes.filename,
        sortOrder: episodes.sortOrder,
        deletedAt: episodes.deletedAt,
      })
      .from(episodes)
      .where(eq(episodes.sourceId, sourceRow.id));

    const normalizedEpisodes = preserveEpisodeIdentity(
      existingEpisodes,
      importedSource.episodes,
    );
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
            purgeAfter: null,
          })),
        )
        .onConflictDoUpdate({
          target: [episodes.sourceId, episodes.episodeKey],
          targetWhere: sql`${episodes.deletedAt} IS NULL`,
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
            version: sql<number>`${episodes.version} + 1`,
          },
        });
    }

    if (result.softDeletes.length > 0) {
      await tx
        .update(episodes)
        .set({
          deletedAt: now,
          purgeAfter: thirtyDaysFromNow,
          updatedAt: now,
          version: sql<number>`${episodes.version} + 1`,
        })
        .where(
          and(
            eq(episodes.sourceId, sourceRow.id),
            inArray(episodes.episodeKey, result.softDeletes),
            isNull(episodes.deletedAt),
          ),
        );
    }

    await writeSnapshot(tx, sourceRow.id, importedSource);
  });
}

async function performAutoRefresh(playlistId?: string, signal?: AbortSignal) {
  const conditions = [
    isNull(sources.deletedAt),
    isNull(playlists.deletedAt),
    eq(playlists.autoRefreshDisabled, false),
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
      sourceUrl: sources.sourceUrl,
    })
    .from(sources)
    .innerJoin(playlists, eq(sources.playlistId, playlists.id))
    .where(and(...conditions))
    .orderBy(asc(sources.lastRefreshedAt));

  const staleSources = (await query).filter(
    (sourceRow) => !isNguoncUrl(sourceRow.sourceUrl),
  );

  let touchedCount = 0;

  for (const [index, sourceRow] of staleSources.entries()) {
    if (signal?.aborted) {
      break;
    }

    try {
      await performSourceRefresh(sourceRow, undefined, signal);
      touchedCount++;
    } catch (error) {
      if (signal?.aborted || isAbortError(error)) {
        break;
      }
      console.error("[performAutoRefresh] failed:", sourceRow.sourceUrl, error);
      const message = asErrorMessage(error);
      await updateFailedImport(sourceRow.id, sourceRow.sourceUrl, message);
      touchedCount++;
    }

    if (index < staleSources.length - 1) {
      await sleep(AUTO_REFRESH_DELAY_MS, signal);
    }
  }

  if (touchedCount > 0) {
    revalidatePath("/");
    revalidatePath("/trash");
    revalidateTag("playlists");
  }

  return touchedCount;
}

export { fetchSourceJson, performAutoRefresh };
