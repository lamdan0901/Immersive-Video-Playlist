const bigBuckBunny = {
  name: "Big Buck Bunny",
  slug: "big-buck-bunny",
  link_m3u8: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
};
const bigBuckBunny480p = {
  name: "Big Buck Bunny (480p)",
  slug: "big-buck-bunny-480p",
  link_m3u8: "https://test-streams.mux.dev/x36xhzz/url_6/193039199_mp4_h264_aac_hq_7.m3u8",
};
const tearsOfSteel = {
  name: "Tears of Steel",
  slug: "tears-of-steel",
  link_m3u8: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
};

type DemoEpisode = typeof bigBuckBunny;

function fixture(
  name: string,
  slug: string,
  artwork: string,
  sourceEpisodes: Record<string, DemoEpisode[]>,
) {
  return {
    data: {
      item: {
        name,
        slug,
        thumb_url: `/mock-playlists/${artwork}.jpg`,
        studio: "Blender Foundation",
        episodes: Object.entries(sourceEpisodes).map(([server_name, server_data]) => ({
          server_name,
          server_data,
        })),
      },
    },
  };
}

export const mockPlaylists = new Map([
  ["open-shorts", fixture("Open Film Shorts", "open-shorts", "forest", {
    "Full collection": [bigBuckBunny, tearsOfSteel, bigBuckBunny480p],
    "Bunny variants": [bigBuckBunny, bigBuckBunny480p],
  })],
  ["coastal-break", fixture("Coastal Break", "coastal-break", "coast", {
    "Short films": [bigBuckBunny, bigBuckBunny480p],
  })],
  ["after-dark", fixture("After Dark", "after-dark", "city", {
    "Short films": [tearsOfSteel],
  })],
]);
