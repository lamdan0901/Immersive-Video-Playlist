import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb"
    },
    staleTimes: {
      dynamic: 0,
      static: 0
    }
  }
};

export default nextConfig;
