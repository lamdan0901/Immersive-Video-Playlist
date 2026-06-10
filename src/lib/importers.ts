import type {
  ImportedEpisode,
  ImportedMovie,
  ImportedSource,
  LinkType,
} from "./types";

const IMPORT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";
const BROWSER_IMPORT_RETRY_DELAY_MS = 1000;

export function resolveApiUrl(sourceUrl: string): string {
  try {
    const url = new URL(sourceUrl);

    if (url.hostname.includes("ophim") && url.pathname.startsWith("/phim/")) {
      const slug = url.pathname.slice(6);
      if (slug) {
        return `https://ophim1.com/v1/api/phim/${slug}`;
      }
    }

    if (url.hostname.includes("nguonc") && url.pathname.startsWith("/phim/")) {
      const slug = url.pathname.slice(6);
      if (slug) {
        return `https://${url.hostname}/api/film/${slug}`;
      }
    }

    return sourceUrl;
  } catch {
    return sourceUrl;
  }
}

export function resolveNguoncPageUrl(sourceUrl: string): string | null {
  try {
    const url = new URL(sourceUrl);
    if (!url.hostname.includes("nguonc")) {
      return null;
    }

    if (url.pathname.startsWith("/phim/")) {
      return url.toString();
    }

    if (url.pathname.startsWith("/api/film/")) {
      const slug = url.pathname.slice(10).replace(/^\/+|\/+$/g, "");
      return slug ? `https://${url.hostname}/phim/${slug}` : null;
    }

    return null;
  } catch {
    return null;
  }
}

export function isNguoncUrl(sourceUrl: string): boolean {
  try {
    return new URL(sourceUrl).hostname.includes("nguonc");
  } catch {
    return false;
  }
}

export function extractNguoncSlug(sourceUrl: string): string | null {
  try {
    const url = new URL(sourceUrl);
    if (!url.hostname.includes("nguonc")) {
      return null;
    }

    if (url.pathname.startsWith("/api/film/")) {
      return url.pathname.slice(10).replace(/^\/+|\/+$/g, "") || null;
    }

    if (url.pathname.startsWith("/phim/")) {
      return url.pathname.slice(6).replace(/^\/+|\/+$/g, "") || null;
    }

    return null;
  } catch {
    return null;
  }
}

export function getNguoncRelayBaseUrl(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_NGUONC_PROXY_API_BASE_URL?.trim() ||
    process.env.NGUONC_PROXY_API_BASE_URL?.trim() ||
    undefined
  );
}

export function resolveNguoncBrowserFallbackUrl(rawUrl: string): string | null {
  const relayBaseUrl = getNguoncRelayBaseUrl();
  const slug = extractNguoncSlug(rawUrl);

  if (!relayBaseUrl || !slug) {
    return null;
  }

  return `${relayBaseUrl.replace(/\/+$/, "")}/${slug}`;
}

export function buildImportRequestHeaders(
  sourceUrl: string,
  accept: string,
): HeadersInit {
  try {
    const url = new URL(sourceUrl);
    const referer = resolveNguoncPageUrl(sourceUrl) ?? `${url.origin}/`;

    return {
      accept,
      "accept-language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
      origin: url.origin,
      referer,
      "user-agent": IMPORT_USER_AGENT,
    };
  } catch {
    return {
      accept,
      "accept-language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
      "user-agent": IMPORT_USER_AGENT,
    };
  }
}

export async function fetchImportPayloadInBrowser(rawUrl: string): Promise<{
  sourceUrl: string;
  importedJson: unknown;
}> {
  const sourceUrl = resolveApiUrl(rawUrl);

  const relayUrl = resolveNguoncBrowserFallbackUrl(rawUrl);
  if (relayUrl) {
    console.log(`[fetchImportPayloadInBrowser] Trying relay: ${relayUrl}`);
    try {
      const response = await fetch(relayUrl);
      if (response.ok) {
        console.log("[fetchImportPayloadInBrowser] Relay succeeded");
        return {
          sourceUrl,
          importedJson: await response.json(),
        };
      }

      console.log(
        `[fetchImportPayloadInBrowser] Relay failed with status: ${response.status}`,
      );
    } catch (error) {
      console.log("[fetchImportPayloadInBrowser] Relay error:", error);
    }
  } else {
    const relayBaseUrl = getNguoncRelayBaseUrl();
    const slug = extractNguoncSlug(rawUrl);
    console.log(
      "[fetchImportPayloadInBrowser] Relay not available:",
      JSON.stringify({
        hasRelayBaseUrl: !!relayBaseUrl,
        relayBaseUrl: relayBaseUrl ?? null,
        hasSlug: !!slug,
        isNguonc: isNguoncUrl(rawUrl),
      }),
    );
  }

  let lastStatus = 0;

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(sourceUrl);
    if (response.ok) {
      return {
        sourceUrl,
        importedJson: await response.json(),
      };
    }

    lastStatus = response.status;
    if (response.status !== 429 || attempt === 1) {
      break;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, BROWSER_IMPORT_RETRY_DELAY_MS);
    });
  }

  if (lastStatus === 429) {
    throw new Error(
      "NguonC is temporarily rate-limiting this import (429). Please wait 1–2 minutes and try again.",
    );
  }

  throw new Error(`Import request failed with ${lastStatus}`);
}

type RawEpisode = {
  name?: unknown;
  slug?: unknown;
  filename?: unknown;
  link_embed?: unknown;
  link_m3u8?: unknown;
  embed?: unknown;
  m3u8?: unknown;
};

type RawServer = {
  server_name?: unknown;
  server_data?: RawEpisode[];
  items?: RawEpisode[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function matchFirst(html: string, pattern: RegExp): string | null {
  const match = pattern.exec(html);
  return match?.[1]?.trim() ?? null;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(url: string | null, baseUrl: string): string | null {
  if (!url) return null;

  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return url;
  }
}

function parseNguoncImageMeta(
  rawValue: string | null,
  pageUrl: string,
): { thumbUrl: string | null; posterUrl: string | null } {
  if (!rawValue) {
    return { thumbUrl: null, posterUrl: null };
  }

  const decoded = decodeHtmlEntities(rawValue);
  if (decoded.startsWith("{")) {
    try {
      const imageRecord = JSON.parse(decoded) as Record<string, unknown>;
      const thumbUrl =
        absoluteUrl(
          asString(imageRecord.original) ?? asString(imageRecord.resize),
          pageUrl,
        ) ?? absoluteUrl(decoded, pageUrl);
      const posterUrl = absoluteUrl(asString(imageRecord.poster), pageUrl);
      return { thumbUrl, posterUrl };
    } catch {
      return { thumbUrl: absoluteUrl(decoded, pageUrl), posterUrl: null };
    }
  }

  return { thumbUrl: absoluteUrl(decoded, pageUrl), posterUrl: null };
}

type NguoncHtmlServer = {
  server_name?: unknown;
  list?: RawEpisode[];
  items?: RawEpisode[];
};

export function extractNguoncPayloadFromHtml(
  html: string,
  sourceUrl: string,
): Record<string, unknown> {
  const pageUrl = resolveNguoncPageUrl(sourceUrl) ?? sourceUrl;
  const canonicalUrl =
    matchFirst(html, /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i) ??
    pageUrl;
  const slug = (() => {
    try {
      const pathname = new URL(canonicalUrl).pathname;
      return pathname.startsWith("/phim/")
        ? pathname.slice(6).replace(/^\/+|\/+$/g, "")
        : null;
    } catch {
      return null;
    }
  })();

  const title = matchFirst(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);

  const normalizedTitle =
    (title ? stripTags(title) : null) ??
    matchFirst(html, /<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)
      ?.split(" - ")[0]
      ?.trim() ??
    slug ??
    "Untitled Playlist";

  const { thumbUrl, posterUrl } = parseNguoncImageMeta(
    matchFirst(html, /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i),
    canonicalUrl,
  );

  const rawEpisodes = matchFirst(html, /var\s+episodes\s*=\s*(\[[\s\S]*?\]);/i);
  if (!rawEpisodes) {
    throw new Error("Unsupported import response");
  }

  const parsedEpisodes = JSON.parse(rawEpisodes) as NguoncHtmlServer[];
  const episodes = parsedEpisodes.map((server) => ({
    server_name: server.server_name,
    items: Array.isArray(server.list)
      ? server.list
      : Array.isArray(server.items)
        ? server.items
        : [],
  }));

  return {
    status: "success",
    movie: {
      name: normalizedTitle,
      slug,
      thumb_url: thumbUrl,
      poster_url: posterUrl ?? thumbUrl,
      episodes,
    },
  };
}

function normalizeNumber(value: string): string {
  const match = value.match(/\d+(?:\.\d+)?/);
  return match
    ? match[0]
    : value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

function absoluteImage(url: string | null, cdn: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (!cdn) return url;
  return `${cdn.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
}

export function makeEpisodeKey(
  episode: { slug?: unknown; name?: unknown },
  sourceKey: string,
): string {
  const slug = asString(episode.slug);
  if (slug) return slug;
  const name = asString(episode.name) ?? "episode";
  return `${sourceKey}:${normalizeNumber(name)}`;
}

function normalizeEpisodes(
  rows: RawEpisode[],
  sourceKey: string,
): ImportedEpisode[] {
  return rows
    .map((episode, index) => {
      const title = asString(episode.name) ?? `${index + 1}`;
      return {
        episodeKey: makeEpisodeKey(episode, sourceKey),
        title,
        slug: asString(episode.slug),
        filename: asString(episode.filename),
        embedUrl: asString(episode.link_embed) ?? asString(episode.embed),
        m3u8Url: asString(episode.link_m3u8) ?? asString(episode.m3u8),
      };
    })
    .filter((episode) => episode.embedUrl != null || episode.m3u8Url != null);
}

function normalizeServers(
  servers: RawServer[],
  sourceUrl: string,
): ImportedSource[] {
  return servers.map((server, index) => {
    const sourceTitle = asString(server.server_name) ?? `Source ${index + 1}`;
    const sourceKey =
      sourceTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || `source-${index + 1}`;
    const rows = Array.isArray(server.server_data)
      ? server.server_data
      : Array.isArray(server.items)
        ? server.items
        : [];
    const preferredLinkType: LinkType = "embed";

    return {
      sourceKey,
      sourceTitle,
      sourceUrl,
      preferredLinkType,
      episodes: normalizeEpisodes(rows, sourceKey),
    };
  });
}

export function normalizeImportedMovie(
  data: unknown,
  sourceUrl: string,
): ImportedMovie {
  const record = data as Record<string, unknown>;
  const isNguonC = sourceUrl.includes("phim.nguonc.com");
  const isOPhim = sourceUrl.includes("ophim1.com");
  const item = (
    isNguonC
      ? record.movie
      : isOPhim
        ? (record.data as Record<string, unknown> | undefined)?.item
        : null
  ) as Record<string, unknown> | null;

  if (!item) {
    throw new Error("Unsupported import response");
  }

  const allServers = Array.isArray(item.episodes)
    ? (item.episodes as RawServer[])
    : [];
  const vietsubServers = allServers.filter((server) => {
    const name = asString(server.server_name);
    return name != null && name.toLowerCase().startsWith("vietsub");
  });
  const rawServers = vietsubServers.length > 0 ? vietsubServers : allServers;
  const responseData = record.data as Record<string, unknown> | undefined;
  const seoSchema = asRecord(
    asRecord(asRecord(responseData?.seoOnPage)?.seoSchema),
  );
  const cdn =
    asString(responseData?.APP_DOMAIN_CDN_IMAGE) ??
    asString(record.APP_DOMAIN_CDN_IMAGE);
  const imageUrl =
    asString(seoSchema?.image) ?? absoluteImage(asString(item.thumb_url), cdn);
  const posterUrl = absoluteImage(asString(item.poster_url), cdn);

  return {
    title: asString(item.name) ?? "Untitled Playlist",
    slug: asString(item.slug),
    imageUrl,
    posterUrl,
    metadata: item,
    sources: normalizeServers(rawServers, sourceUrl),
  };
}
