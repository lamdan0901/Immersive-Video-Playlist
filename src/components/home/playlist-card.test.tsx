import { vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlaylistCard } from "./playlist-card";

vi.mock("@/actions/playlists", () => ({
  softDeletePlaylist: vi.fn(),
  togglePinPlaylist: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

it("renders stable UTC calendar dates", () => {
  render(
    <PlaylistCard
      playlist={{
        id: "playlist-1",
        title: "Fate Chooses You",
        sourceTitles: ["Vietsub"],
        metadataText: "romance",
        pinned: false,
        pinnedOrder: 0,
        version: 1,
        lastPlayedAt: "2026-05-01T23:30:00.000-05:00",
        updatedAt: "2026-05-09T08:15:00.000Z",
        activeSourceTitle: "Vietsub",
        activeSourceLastPlayedEpisodeIndex: 2,
        activeSourceTotalEpisodes: 12,
        banner: {
          type: "gradient",
          value: "linear-gradient(135deg, #14532d, #1d4ed8)",
          initials: "FC",
        },
      }}
    />,
  );

  expect(screen.getByText("Last played 2026-05-02")).toBeInTheDocument();
});
