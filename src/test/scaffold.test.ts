import { describe, expect, it } from "vitest";

describe("scaffold", () => {
  it("loads the test environment", () => {
    expect(document.body).toBeInTheDocument();
  });
});
