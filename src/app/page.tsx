import { Suspense } from "react";
import { getPlaylistSummaries } from "@/db/queries/home";
import { getPlaylistGroups } from "@/db/queries/playlist-groups";
import { PlaylistHomeClient } from "@/components/home/playlist-home-client";

export const dynamic = "force-dynamic";

async function HomeData() {
  const [playlists, groups] = await Promise.all([getPlaylistSummaries(), getPlaylistGroups()]);
  return <PlaylistHomeClient playlists={playlists} groups={groups} />;
}

export default function HomePage() {
  return (
    <main className="home-page">
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
