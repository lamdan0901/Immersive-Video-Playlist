## NguonC relay setup

This repo supports an optional NguonC JSON relay for server-side imports and refreshes.

### Why use it

- Vercel may get `403` or `429` from `phim.nguonc.com`
- a relay gives the app a different network identity
- once configured, the app will use the relay for:
  - playlist import
  - source creation
  - source refresh
  - cron auto-refresh

### Included Worker example

Files:

- `conductor/nguonc-relay/worker.js`
- `conductor/nguonc-relay/wrangler.toml.example`

The Worker exposes:

- `GET /api/film/:slug`

and forwards to:

- `https://phim.nguonc.com/api/film/:slug`

### Deploy with Cloudflare Workers

1. Copy `conductor/nguonc-relay/wrangler.toml.example` to `wrangler.toml`
2. From `conductor/nguonc-relay`, deploy with Wrangler
3. Note your worker URL, for example:
   - `https://nguonc-relay.your-subdomain.workers.dev`

### Vercel env var

Set this in Vercel:

- `NGUONC_PROXY_API_BASE_URL=https://nguonc-relay.your-subdomain.workers.dev/api/film`

Important:

- do **not** include the slug in the env var
- the app appends the slug automatically

### Example

If a user imports:

- `https://phim.nguonc.com/phim/dai-duong-me-vu`

the app resolves the slug and calls:

- `https://nguonc-relay.your-subdomain.workers.dev/api/film/dai-duong-me-vu`

### Current app behavior

- server-side import tries the relay first when configured
- homepage NguonC import falls back to browser fetch only if server-side still returns upstream `403` or `429`