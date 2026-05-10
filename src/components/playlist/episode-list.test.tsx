import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EpisodeList } from "./episode-list";

const episodes = Array.from({ length: 20 }, (_, index) => ({
  episodeKey: `episode-${index + 1}`,
  title: `Episode ${index + 1}`,
  lastPlayedSeconds: index === 1 ? 32 : 0
}));

describe("EpisodeList", () => {
  it("renders episodes in grid mode without a list display toggle", () => {
    const onSelect = vi.fn();

    render(
      <EpisodeList
        episodes={episodes}
        currentEpisodeIndex={1}
        onSelect={onSelect}
      />
    );

    expect(screen.getByText("Episodes")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Episode view mode" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "List" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Episode 2" })).toHaveAttribute("aria-pressed", "true");

    const list = screen.getByLabelText("Episode list").querySelector(".playlist-detail-episode-list");
    expect(list).not.toBeNull();
    expect(list).toHaveClass("playlist-detail-episode-list-grid");
    expect(list).not.toHaveClass("playlist-detail-episode-list-grid-compact");
  });

  it("uses the compact grid class when there are more than 20 episodes", () => {
    const onSelect = vi.fn();

    render(
      <EpisodeList
        episodes={[
          ...episodes,
          {
            episodeKey: "episode-21",
            title: "Episode 21",
            lastPlayedSeconds: 0
          }
        ]}
        currentEpisodeIndex={0}
        onSelect={onSelect}
      />
    );

    const list = screen.getByLabelText("Episode list").querySelector(".playlist-detail-episode-list");
    expect(list).not.toBeNull();
    expect(list).toHaveClass("playlist-detail-episode-list-grid-compact");
  });

  it("selects an episode when clicked", () => {
    const onSelect = vi.fn();

    render(
      <EpisodeList
        episodes={episodes}
        currentEpisodeIndex={0}
        onSelect={onSelect}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Episode 3" }));

    expect(onSelect).toHaveBeenCalledWith(2);
  });
});
