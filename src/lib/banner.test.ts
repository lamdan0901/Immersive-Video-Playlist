import { chooseBanner } from "./banner";

it("uses manual override first", () => {
  expect(chooseBanner({ title: "A", bannerOverrideUrl: "https://x.test/a.jpg", derivedImageUrl: "https://x.test/b.jpg", sourceImages: [] })).toEqual({
    type: "image",
    value: "https://x.test/a.jpg"
  });
});

it("uses first source image before second source image", () => {
  expect(chooseBanner({ title: "A", bannerOverrideUrl: null, derivedImageUrl: null, sourceImages: ["https://x.test/1.jpg", "https://x.test/2.jpg"] })).toEqual({
    type: "image",
    value: "https://x.test/1.jpg"
  });
});

it("falls back to deterministic gradient", () => {
  expect(chooseBanner({ title: "Fate Chooses You", bannerOverrideUrl: null, derivedImageUrl: null, sourceImages: [] })).toEqual({
    type: "gradient",
    value: "linear-gradient(135deg, #14532d, #1d4ed8)",
    initials: "FC"
  });
});
