import ophim from "@/test/fixtures/sample-ophim.json";
import nguonc from "@/test/fixtures/sample-nguonc.json";
import { makeEpisodeKey, normalizeImportedMovie, resolveApiUrl } from "./importers";

describe("normalizeImportedMovie", () => {
  it("prefers OPhim seo schema image for playlist artwork", () => {
    const movie = normalizeImportedMovie(
      {
        data: {
          seoOnPage: {
            seoSchema: {
              image: "https://img.ophim.live/uploads/movies/cuoc-chien-ngan-ha-maul-chua-te-bong-toi-thumb.jpg"
            }
          },
          item: {
            name: "Cuoc Chien Ngan Ha",
            slug: "cuoc-chien-ngan-ha-maul-chua-te-bong-toi",
            thumb_url: "cuoc-chien-ngan-ha-maul-chua-te-bong-toi-thumb.jpg",
            poster_url: "cuoc-chien-ngan-ha-maul-chua-te-bong-toi-poster.jpg",
            episodes: []
          },
          APP_DOMAIN_CDN_IMAGE: "https://img.ophim.live"
        }
      },
      "https://ophim1.com/v1/api/phim/cuoc-chien-ngan-ha-maul-chua-te-bong-toi"
    );

    expect(movie.imageUrl).toBe("https://img.ophim.live/uploads/movies/cuoc-chien-ngan-ha-maul-chua-te-bong-toi-thumb.jpg");
  });

  it("normalizes OPhim source data", () => {
    const movie = normalizeImportedMovie(ophim, "https://ophim1.com/v1/api/phim/giai-ngau-thien-thanh");

    expect(movie.title).toBe("Giai Ngẫu Thiên Thành");
    expect(movie.sources).toHaveLength(1);
    expect(movie.sources[0].sourceTitle).toBe("Vietsub #1");
    expect(movie.sources[0].preferredLinkType).toBe("embed");
    expect(movie.sources[0].episodes[0]).toMatchObject({
      episodeKey: "1",
      title: "1",
      embedUrl: "https://vip.opstream90.com/share/b453b5a7a737a3fc489fa11aaac1618b"
    });
    expect(movie.imageUrl).toBe("https://img.ophim.live/uploads/movies/giai-ngau-thien-thanh-thumb.jpg");
    expect(movie.posterUrl).toBe("https://img.ophim.live/giai-ngau-thien-thanh-poster.jpg");
  });

  it("normalizes NguonC source data", () => {
    const movie = normalizeImportedMovie(nguonc, "https://phim.nguonc.com/api/film/vuong-mien-hoan-hao");

    expect(movie.title).toBe("Vương Miện Hoàn Hảo");
    expect(movie.sources).toHaveLength(1);
    expect(movie.sources[0].sourceTitle).toBe("Vietsub #1");
    expect(movie.sources[0].preferredLinkType).toBe("embed");
    expect(movie.sources[0].episodes[0]).toMatchObject({
      episodeKey: "tap-1",
      title: "1",
      embedUrl: "https://embed13.streamc.xyz/embed.php?hash=05d1260ef455a2305874f749a8294a36"
    });
    expect(movie.imageUrl).toContain("vuong-mien-hoan-hao.jpg");
  });

  it("filters NguonC to only Vietsub when multiple servers exist", () => {
    const multiServerPayload = {
      status: "success",
      movie: {
        name: "Vũ Lâm Linh",
        slug: "vu-lam-linh",
        thumb_url: "https://phim.nguonc.com/public/images/Post/10/vu-lam-linh.jpg",
        episodes: [
          {
            server_name: "Vietsub #1",
            items: [
              { name: "1", slug: "tap-1", embed: "https://embed13.streamc.xyz/embed.php?hash=vietsub1" },
              { name: "2", slug: "tap-2", embed: "https://embed12.streamc.xyz/embed.php?hash=vietsub2" },
            ]
          },
          {
            server_name: "Thuyết minh #1",
            items: [
              { name: "1", slug: "tap-1", embed: "https://embed13.streamc.xyz/embed.php?hash=tm1" },
            ]
          },
        ]
      }
    };

    const movie = normalizeImportedMovie(multiServerPayload, "https://phim.nguonc.com/api/film/vu-lam-linh");
    expect(movie.sources).toHaveLength(1);
    expect(movie.sources[0].sourceTitle).toBe("Vietsub #1");
    expect(movie.sources[0].episodes).toHaveLength(2);
  });

  it("filters OPhim to only Vietsub when multiple servers exist", () => {
    const multiServerPayload = {
      data: {
        item: {
          name: "Test Movie",
          slug: "test-movie",
          thumb_url: "test-thumb.jpg",
          episodes: [
            {
              server_name: "Vietsub #1",
              server_data: [
                { name: "1", slug: "1", link_embed: "https://embed/vietsub1" },
              ]
            },
            {
              server_name: "Thuyết Minh #1",
              server_data: [
                { name: "1", slug: "1", link_embed: "https://embed/tm1" },
              ]
            },
          ]
        },
        APP_DOMAIN_CDN_IMAGE: "https://img.ophim.live"
      }
    };

    const movie = normalizeImportedMovie(multiServerPayload, "https://ophim1.com/v1/api/phim/test-movie");
    expect(movie.sources).toHaveLength(1);
    expect(movie.sources[0].sourceTitle).toBe("Vietsub #1");
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

describe("resolveApiUrl", () => {
  it("converts normal OPhim URL to API URL", () => {
    expect(resolveApiUrl("https://ophim18.cc/phim/sup-do-phan-2"))
      .toBe("https://ophim1.com/v1/api/phim/sup-do-phan-2");
  });

  it("converts normal NguonC URL to API URL", () => {
    expect(resolveApiUrl("https://phim.nguonc.com/phim/vuong-mien-hoan-hao"))
      .toBe("https://phim.nguonc.com/api/film/vuong-mien-hoan-hao");
  });

  it("leaves API OPhim URL unchanged", () => {
    expect(resolveApiUrl("https://ophim1.com/v1/api/phim/sup-do-phan-2"))
      .toBe("https://ophim1.com/v1/api/phim/sup-do-phan-2");
  });

  it("leaves API NguonC URL unchanged", () => {
    expect(resolveApiUrl("https://phim.nguonc.com/api/film/vuong-mien-hoan-hao"))
      .toBe("https://phim.nguonc.com/api/film/vuong-mien-hoan-hao");
  });

  it("leaves unrelated URLs unchanged", () => {
    expect(resolveApiUrl("https://example.com/phim/test"))
      .toBe("https://example.com/phim/test");
    expect(resolveApiUrl("invalid url"))
      .toBe("invalid url");
  });
});
