export type LinkType = "m3u8" | "embed";

export type ImportedEpisode = {
  episodeKey: string;
  title: string;
  slug: string | null;
  filename: string | null;
  embedUrl: string | null;
  m3u8Url: string | null;
};

export type ImportedSource = {
  sourceKey: string;
  sourceTitle: string;
  sourceUrl: string;
  preferredLinkType: LinkType;
  episodes: ImportedEpisode[];
};

export type ImportedMovie = {
  title: string;
  slug: string | null;
  imageUrl: string | null;
  posterUrl: string | null;
  metadata: Record<string, unknown>;
  sources: ImportedSource[];
};
