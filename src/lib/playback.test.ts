import { resolveInitialPlayback, shouldSavePlayback } from "./playback";

const source = {
  id: "source-1",
  episodes: [
    { episodeKey: "ep-1" },
    { episodeKey: "ep-2" }
  ],
  lastPlayedEpisodeKey: "ep-2"
};

it("prefers query source and episode when valid", () => {
  expect(resolveInitialPlayback([source], { sourceId: "source-1", episodeIndex: "0" })).toEqual({
    sourceId: "source-1",
    episodeIndex: 0
  });
});

it("falls back to source last played episode", () => {
  expect(resolveInitialPlayback([source], { sourceId: "source-1", episodeIndex: null })).toEqual({
    sourceId: "source-1",
    episodeIndex: 1
  });
});

it("does not save unchanged timestamps", () => {
  expect(shouldSavePlayback(30, 30)).toBe(false);
  expect(shouldSavePlayback(31, 30)).toBe(true);
});
