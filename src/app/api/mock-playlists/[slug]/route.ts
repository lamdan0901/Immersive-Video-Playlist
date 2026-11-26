import { isMockPlaylistMode } from "@/db/client";
import { mockPlaylists } from "@/db/mock-playlist-fixtures";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!isMockPlaylistMode()) return new Response(null, { status: 404 });

  const { slug } = await params;
  const payload = mockPlaylists.get(slug);
  return payload ? Response.json(payload) : new Response(null, { status: 404 });
}
