const API_PREFIX = "/api/film/";
const CACHE_TTL_SECONDS = 300;

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=60",
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    },
  });
}

function getSlug(pathname) {
  if (!pathname.startsWith(API_PREFIX)) {
    return null;
  }

  const slug = pathname.slice(API_PREFIX.length).replace(/^\/+|\/+$/g, "");
  return slug || null;
}

const worker = {
  async fetch(request) {
    if (request.method !== "GET") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    const url = new URL(request.url);
    const slug = getSlug(url.pathname);
    if (!slug) {
      return json({ error: "Not found" }, { status: 404 });
    }

    const upstreamUrl = new URL(
      `https://phim.nguonc.com/api/film/${encodeURIComponent(slug)}`,
    );

    try {
      const upstream = await fetch(upstreamUrl.toString(), {
        cf: {
          cacheEverything: true,
          cacheTtl: CACHE_TTL_SECONDS,
        },
        headers: {
          accept: "application/json,text/plain,*/*",
        },
      });

      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: {
          "access-control-allow-origin": "*",
          "cache-control": `public, s-maxage=${CACHE_TTL_SECONDS}, max-age=60`,
          "content-type":
            upstream.headers.get("content-type") ||
            "application/json; charset=utf-8",
        },
      });
    } catch (error) {
      return json(
        {
          error: "Relay upstream fetch failed",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 502 },
      );
    }
  },
};

export default worker;