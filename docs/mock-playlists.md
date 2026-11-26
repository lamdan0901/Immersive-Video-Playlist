# Mock playlists

Set `MOCK_PLAYLISTS=true` in `.env.local` and run `npm run dev`. Open
`http://localhost:3033` to see three seeded playlists. Mock mode works without a
`DATABASE_URL`. Unlock editing with your configured `ADMIN_SECRET`.

To test creating a playlist or adding a source, paste
`http://localhost:3033/api/mock-playlists/open-shorts` into the import field.
The other sample URLs end in `coastal-break` and `after-dark`.

Playlists, sources, watch progress, and volume persist in the project’s
`.mock-playlists/` directory. Set `MOCK_PLAYLISTS=false` and restart the dev
server to switch back to Neon. Run one dev server per project directory while
using mock mode.

## Media credits

- Forest artwork by Mary Brennan. [Unsplash photo](https://unsplash.com/photos/a-mountain-covered-in-trees-and-fog-uCcCAf6hGQU)
- Coast artwork by Hameen Reynolds. [Unsplash photo](https://unsplash.com/photos/aerial-view-of-waves-crashing-on-a-sandy-beach-zWFa7mlQAYk)
- City artwork by Jesse Mills. [Unsplash photo](https://unsplash.com/photos/city-buildings-during-night-time-c9N-57Is7LA)

The artwork is bundled under the [Unsplash License](https://unsplash.com/license).
The demo films stream from public HLS hosts and require internet access.
Big Buck Bunny and Tears of Steel are © Blender Foundation.
[Big Buck Bunny credits](https://studio.blender.org/projects/big-buck-bunny/pages/credits/)
and [Tears of Steel credits](https://studio.blender.org/projects/tears-of-steel/pages/credits/).
