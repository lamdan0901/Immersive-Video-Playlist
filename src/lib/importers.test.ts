import ophim from "@/test/fixtures/sample-ophim.json";
import nguonc from "@/test/fixtures/sample-nguonc.json";
import { makeEpisodeKey, normalizeImportedMovie } from "./importers";

describe("normalizeImportedMovie", () => {
  it("normalizes OPhim source data", () => {
    const movie = normalizeImportedMovie(ophim, "https://ophim1.com/v1/api/phim/giai-ngau-thien-thanh");

    expect(movie.title).toBe("Giai Ngẫu Thiên Thành");
    expect(movie.sources).toHaveLength(2);
    expect(movie.sources[0].sourceTitle).toBe("Vietsub #1");
    expect(movie.sources[0].episodes[0]).toMatchObject({
      episodeKey: "1",
      title: "1",
      embedUrl: "https://vip.opstream90.com/share/b453b5a7a737a3fc489fa11aaac1618b"
    });
    expect(movie.imageUrl).toBe("https://img.ophim.live/giai-ngau-thien-thanh-thumb.jpg");
    expect(movie.posterUrl).toBe("https://img.ophim.live/giai-ngau-thien-thanh-poster.jpg");
  });

  it("normalizes NguonC source data", () => {
    const movie = normalizeImportedMovie(nguonc, "https://phim.nguonc.com/api/film/vuong-mien-hoan-hao");

    expect(movie.title).toBe("Vương Miện Hoàn Hảo");
    expect(movie.sources).toHaveLength(1);
    expect(movie.sources[0].sourceTitle).toBe("Vietsub #1");
    expect(movie.sources[0].episodes[0]).toMatchObject({
      episodeKey: "tap-1",
      title: "1",
      embedUrl: "https://embed13.streamc.xyz/embed.php?hash=05d1260ef455a2305874f749a8294a36"
    });
    expect(movie.imageUrl).toContain("vuong-mien-hoan-hao.jpg");
  });
});

describe("makeEpisodeKey", () => {
  it("uses upstream slug when present", () => {
    expect(makeEpisodeKey({ slug: "tap-12", name: "12" }, "source-a")).toBe("tap-12");
  });

  it("falls back to normalized episode number plus source key", () => {
    expect(makeEpisodeKey({ name: "Tập 12" }, "source-a")).toBe("source-a:12");
  });
});
