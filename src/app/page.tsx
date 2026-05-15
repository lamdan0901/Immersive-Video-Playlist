import { Suspense } from "react";
import { getPlaylistSummaries } from "@/db/queries/home";
import { PlaylistHomeClient } from "@/components/home/playlist-home-client";
import { AutoRefreshTrigger } from "@/components/auto-refresh-trigger";

export const dynamic = "force-dynamic";

async function HomeData() {
  const playlists = await getPlaylistSummaries();
  return <PlaylistHomeClient playlists={playlists} />;
}

export default function HomePage() {
  return (
    <main className="home-page">
      <AutoRefreshTrigger />
      <Suspense
        fallback={
          <div className="home-skeleton" aria-label="Loading playlists" />
        }
      >
        <HomeData />
      </Suspense>
    </main>
  );
}
