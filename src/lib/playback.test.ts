import { resolveInitialPlayback, resolveSkipStartSeconds, shouldSavePlayback } from "./playback";

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

it("extracts a non-negative integer playlist skip start from metadata", () => {
  expect(resolveSkipStartSeconds({ skipStartSeconds: 27.8 })).toBe(27);
  expect(resolveSkipStartSeconds({ skipStartSeconds: "12" })).toBe(12);
  expect(resolveSkipStartSeconds({ skipStartSeconds: -4 })).toBe(0);
  expect(resolveSkipStartSeconds({})).toBe(0);
  expect(resolveSkipStartSeconds(null)).toBe(0);
});
