import { describe, expect, it } from "vitest";
import { formatPlaybackTime } from "./format-playback-time";

describe("formatPlaybackTime", () => {
  it("formats short durations as m:ss", () => {
    expect(formatPlaybackTime(0)).toBe("0:00");
    expect(formatPlaybackTime(65)).toBe("1:05");
  });

  it("formats long durations with hours", () => {
    expect(formatPlaybackTime(3661)).toBe("1:01:01");
  });
});