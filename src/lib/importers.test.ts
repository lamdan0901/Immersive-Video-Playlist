import ophim from "@/test/fixtures/sample-ophim.json";
import nguonc from "@/test/fixtures/sample-nguonc.json";
import { describe, expect, it, vi } from "vitest";
import {
  extractNguoncPayloadFromHtml,
  fetchImportPayloadInBrowser,
  isNguoncUrl,
  makeEpisodeKey,
  normalizeImportedMovie,
  resolveApiUrl,
  resolveNguoncPageUrl,
} from "./importers";

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

  it("drops episodes with no playable URLs", () => {
    const payload = {
      status: "success",
      movie: {
        name: "Gia Nghiep",
        slug: "gia-nghiep",
        thumb_url: "https://phim.nguonc.com/public/images/Post/5/gia-nghiep.jpg",
        episodes: [
          {
            server_name: "Vietsub #1",
            items: [
              { name: "1", slug: "tap-1", embed: "https://embed.test/hash1", m3u8: "https://m3u8.test/1/hls.m3u8" },
              { name: "12", slug: "tap-12" },
            ]
          }
        ]
      }
    };

    const movie = normalizeImportedMovie(payload, "https://phim.nguonc.com/api/film/gia-nghiep");
    expect(movie.sources[0].episodes).toHaveLength(1);
    expect(movie.sources[0].episodes[0].episodeKey).toBe("tap-1");
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

describe("resolveNguoncPageUrl", () => {
  it("converts NguonC API URLs back to page URLs", () => {
    expect(resolveNguoncPageUrl("https://phim.nguonc.com/api/film/vuong-mien-hoan-hao"))
      .toBe("https://phim.nguonc.com/phim/vuong-mien-hoan-hao");
  });

  it("keeps NguonC page URLs unchanged", () => {
    expect(resolveNguoncPageUrl("https://phim.nguonc.com/phim/vuong-mien-hoan-hao"))
      .toBe("https://phim.nguonc.com/phim/vuong-mien-hoan-hao");
  });
});

describe("isNguoncUrl", () => {
  it("detects NguonC hosts", () => {
    expect(isNguoncUrl("https://phim.nguonc.com/phim/vuong-mien-hoan-hao")).toBe(
      true,
    );
    expect(isNguoncUrl("https://ophim1.com/v1/api/phim/test-movie")).toBe(false);
  });
});

describe("fetchImportPayloadInBrowser", () => {
  it("resolves page URLs to API URLs before fetching", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => nguonc,
      }),
    );

    const result = await fetchImportPayloadInBrowser(
      "https://phim.nguonc.com/phim/vuong-mien-hoan-hao",
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://phim.nguonc.com/api/film/vuong-mien-hoan-hao",
    );
    expect(result.sourceUrl).toBe(
      "https://phim.nguonc.com/api/film/vuong-mien-hoan-hao",
    );
    expect((result.importedJson as { status: string }).status).toBe("success");
  });

  it("retries once after a 429 before failing", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 429 })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => nguonc,
        }),
    );

    const startedAt = Date.now();
    const result = await fetchImportPayloadInBrowser(
      "https://phim.nguonc.com/phim/vuong-mien-hoan-hao",
    );

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(900);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect((result.importedJson as { status: string }).status).toBe("success");
  });
});

describe("extractNguoncPayloadFromHtml", () => {
  it("reconstructs NguonC movie payloads from the public film page", () => {
    const payload = extractNguoncPayloadFromHtml(
      `
        <html>
          <head>
            <link rel="canonical" href="https://phim.nguonc.com/phim/huyen-thoai-linh-bep">
            <meta property="og:title" content="Huyền Thoại Lính Bếp - The Legend of Kitchen Soldier">
            <meta property="og:image" content="{&quot;original&quot;:&quot;/public/images/Post/2/huyen-thoai-linh-bep.jpg&quot;,&quot;poster&quot;:&quot;/public/images/Post/2/huyen-thoai-linh-bep-1.jpg&quot;}">
          </head>
          <body>
            <h1>Huyền Thoại Lính Bếp</h1>
            <script>
              var episodes = [{"server_name":"Vietsub #1","list":[{"name":"1","slug":"tap-1","embed":"https://embed.test/1","m3u8":"https://m3u8.test/1.m3u8"}]}];
            </script>
          </body>
        </html>
      `,
      "https://phim.nguonc.com/api/film/huyen-thoai-linh-bep",
    ) as {
      movie: {
        name: string;
        slug: string;
        thumb_url: string;
        poster_url: string;
        episodes: Array<{ server_name: string; items: Array<{ slug: string }> }>;
      };
    };

    expect(payload.movie.name).toBe("Huyền Thoại Lính Bếp");
    expect(payload.movie.slug).toBe("huyen-thoai-linh-bep");
    expect(payload.movie.thumb_url).toBe(
      "https://phim.nguonc.com/public/images/Post/2/huyen-thoai-linh-bep.jpg",
    );
    expect(payload.movie.poster_url).toBe(
      "https://phim.nguonc.com/public/images/Post/2/huyen-thoai-linh-bep-1.jpg",
    );
    expect(payload.movie.episodes[0]?.server_name).toBe("Vietsub #1");
    expect(payload.movie.episodes[0]?.items[0]?.slug).toBe("tap-1");
  });
});
