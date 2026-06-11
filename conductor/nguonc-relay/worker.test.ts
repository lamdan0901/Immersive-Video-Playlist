import { beforeEach, describe, expect, it, vi } from "vitest";
import worker from "./worker";

describe("nguonc relay worker", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("logs a body snippet when the upstream returns a non-ok status", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("blocked by upstream firewall", {
          status: 403,
          headers: {
            "content-type": "text/plain; charset=utf-8",
          },
        }),
      ),
    );

    const response = await worker.fetch(
      new Request("https://relay.example.com/api/film/kieu-so"),
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("blocked by upstream firewall");
    expect(warnSpy).toHaveBeenCalledWith(
      "[relay-worker] upstream failure",
      expect.objectContaining({
        slug: "kieu-so",
        status: 403,
        snippet: "blocked by upstream firewall",
      }),
    );
  });
});
