import type { ImportedEpisode, ImportedMovie, ImportedSource, LinkType } from "./types";

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
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeNumber(value: string): string {
  const match = value.match(/\d+(?:\.\d+)?/);
  return match ? match[0] : value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function absoluteImage(url: string | null, cdn: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (!cdn) return url;
  return `${cdn.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
}

export function makeEpisodeKey(episode: { slug?: unknown; name?: unknown }, sourceKey: string): string {
  const slug = asString(episode.slug);
  if (slug) return slug;
  const name = asString(episode.name) ?? "episode";
  return `${sourceKey}:${normalizeNumber(name)}`;
}

function normalizeEpisodes(rows: RawEpisode[], sourceKey: string): ImportedEpisode[] {
  return rows.map((episode, index) => {
    const title = asString(episode.name) ?? `${index + 1}`;
    return {
      episodeKey: makeEpisodeKey(episode, sourceKey),
      title,
      slug: asString(episode.slug),
      filename: asString(episode.filename),
      embedUrl: asString(episode.link_embed) ?? asString(episode.embed),
      m3u8Url: asString(episode.link_m3u8) ?? asString(episode.m3u8)
    };
  });
}

function normalizeServers(servers: RawServer[], sourceUrl: string): ImportedSource[] {
  return servers.map((server, index) => {
    const sourceTitle = asString(server.server_name) ?? `Source ${index + 1}`;
    const sourceKey = sourceTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `source-${index + 1}`;
    const rows = Array.isArray(server.server_data) ? server.server_data : Array.isArray(server.items) ? server.items : [];
    const preferredLinkType: LinkType = "embed";

    return {
      sourceKey,
      sourceTitle,
      sourceUrl,
      preferredLinkType,
      episodes: normalizeEpisodes(rows, sourceKey)
    };
  });
}

export function normalizeImportedMovie(data: unknown, sourceUrl: string): ImportedMovie {
  const record = data as Record<string, unknown>;
  const isNguonC = sourceUrl.includes("phim.nguonc.com");
  const isOPhim = sourceUrl.includes("ophim1.com");
  const item = (isNguonC ? record.movie : isOPhim ? (record.data as Record<string, unknown> | undefined)?.item : null) as Record<string, unknown> | null;

  if (!item) {
    throw new Error("Unsupported import response");
  }

  const allServers = Array.isArray(item.episodes) ? (item.episodes as RawServer[]) : [];
  const vietsubServers = allServers.filter((server) => {
    const name = asString(server.server_name);
    return name != null && name.toLowerCase().startsWith("vietsub");
  });
  const rawServers = vietsubServers.length > 0 ? vietsubServers : allServers;
  const responseData = record.data as Record<string, unknown> | undefined;
  const seoSchema = asRecord(asRecord(asRecord(responseData?.seoOnPage)?.seoSchema));
  const cdn = asString(responseData?.APP_DOMAIN_CDN_IMAGE) ?? asString(record.APP_DOMAIN_CDN_IMAGE);
  const imageUrl = asString(seoSchema?.image) ?? absoluteImage(asString(item.thumb_url), cdn);
  const posterUrl = absoluteImage(asString(item.poster_url), cdn);

  return {
    title: asString(item.name) ?? "Untitled Playlist",
    slug: asString(item.slug),
    imageUrl,
    posterUrl,
    metadata: item,
    sources: normalizeServers(rawServers, sourceUrl)
  };
}
