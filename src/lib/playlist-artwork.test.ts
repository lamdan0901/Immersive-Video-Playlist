import { pickDerivedImage } from "./playlist-artwork";

describe("pickDerivedImage", () => {
  it("prefers image url over poster url", () => {
    expect(
      pickDerivedImage({
        imageUrl: "https://img.ophim.live/uploads/movies/example-thumb.jpg",
        posterUrl: "https://img.ophim.live/example-poster.jpg"
      })
    ).toBe("https://img.ophim.live/uploads/movies/example-thumb.jpg");
  });

  it("falls back to poster url when image url is missing", () => {
    expect(
      pickDerivedImage({
        imageUrl: null,
        posterUrl: "https://img.ophim.live/example-poster.jpg"
      })
    ).toBe("https://img.ophim.live/example-poster.jpg");
  });
});
