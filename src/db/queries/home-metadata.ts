function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function compactString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function collectStringValues(value: unknown): string[] {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === "string") return collectStringValues(item);
      if (isRecord(item)) {
        return [
          compactString(item.name),
          compactString(item.title),
          compactString(item.slug)
        ].filter((entry): entry is string => Boolean(entry));
      }
      return [];
    });
  }

  if (isRecord(value)) {
    return Object.values(value).flatMap((item) => {
      if (!isRecord(item)) return [];
      return [
        ...collectStringValues(item.group),
        ...collectStringValues(item.list),
        ...collectStringValues(item.name),
        ...collectStringValues(item.title)
      ];
    });
  }

  return [];
}

function uniqueCompact(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim()))));
}

export function extractMetadataText(metadata: unknown): string {
  if (!isRecord(metadata)) return "";

  const parts = uniqueCompact([
    compactString(metadata.name),
    compactString(metadata.origin_name),
    compactString(metadata.original_name),
    compactString(metadata.slug),
    compactString(metadata.content),
    compactString(metadata.description),
    compactString(metadata.lang),
    compactString(metadata.language),
    compactString(metadata.quality),
    compactString(metadata.year),
    ...collectStringValues(metadata.category),
    ...collectStringValues(metadata.categories),
    ...collectStringValues(metadata.country),
    ...collectStringValues(metadata.countries)
  ]);

  return parts.join(" ");
}

export function extractArtworkUrls(metadata: unknown): string[] {
  if (!isRecord(metadata)) return [];

  return uniqueCompact([
    compactString(metadata.imageUrl),
    compactString(metadata.posterUrl),
    compactString(metadata.thumb_url),
    compactString(metadata.poster_url),
    compactString(metadata.thumbnail)
  ]).filter((value) => /^https?:\/\//i.test(value));
}
