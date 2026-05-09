import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Immersive Video Playlist",
  description: "Public immersive video playlists with admin-gated edits."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
