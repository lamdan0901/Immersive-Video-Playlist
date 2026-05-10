export function pickDerivedImage(source: { posterUrl: string | null; imageUrl: string | null }) {
  return source.imageUrl ?? source.posterUrl;
}
