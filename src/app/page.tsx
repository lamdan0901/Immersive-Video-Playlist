import { Suspense } from "react";
import { getPlaylistSummaries } from "@/db/queries/home";
import { PlaylistHomeClient } from "@/components/home/playlist-home-client";

export const dynamic = "force-dynamic";

async function HomeData() {
  const playlists = await getPlaylistSummaries();
  return <PlaylistHomeClient playlists={playlists} />;
}

export default function HomePage() {
  return (
    <main className="home-page">
      <Suspense fallback={<div className="home-skeleton" aria-label="Loading playlists" />}>
        <HomeData />
      </Suspense>
    </main>
  );
}
