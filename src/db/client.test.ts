import { beforeEach, describe, expect, it, vi } from "vitest";

const { PoolMock, drizzleHttpMock, drizzleServerlessMock } = vi.hoisted(() => ({
  PoolMock: vi.fn(),
  drizzleHttpMock: vi.fn(),
  drizzleServerlessMock: vi.fn(() => "db-instance")
}));

vi.mock("@neondatabase/serverless", () => ({
  Pool: PoolMock
}));

vi.mock("server-only", () => ({}));

vi.mock("drizzle-orm/neon-http", () => ({
  drizzle: drizzleHttpMock
}));

vi.mock("drizzle-orm/neon-serverless", () => ({
  drizzle: drizzleServerlessMock
}));

describe("db client", () => {
  beforeEach(() => {
    vi.resetModules();
    PoolMock.mockReset();
    drizzleHttpMock.mockReset();
    drizzleServerlessMock.mockReset();
    drizzleServerlessMock.mockReturnValue("db-instance");
    process.env.DATABASE_URL = "postgresql://example";
  });

  it("uses the Neon serverless driver so transactions are supported", async () => {
    const clientModule = await import("./client");

    expect(PoolMock).toHaveBeenCalledWith({ connectionString: "postgresql://example" });
    expect(drizzleServerlessMock).toHaveBeenCalled();
    expect(drizzleHttpMock).not.toHaveBeenCalled();
    expect(clientModule.db).toBe("db-instance");
  });
});
