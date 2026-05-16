import type { Metadata } from "next";
import "./globals.css";

export const dynamic = "force-dynamic";
export const fetchCache = "only-no-store";

export const metadata: Metadata = {
  title: "Immersive Video Playlist",
  description: "Public immersive video playlists with admin-gated edits.",
  icons: {
    icon: "/favicon.png"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
