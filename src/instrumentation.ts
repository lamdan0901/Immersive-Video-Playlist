export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NODE_ENV === "development" &&
    process.env.MOCK_PLAYLISTS === "true"
  ) {
    // Keep PGlite's WebAssembly memory out of React's development render traces.
    const { getDb } = await import("./db/client");
    await getDb();
  }
}
