import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  serverExternalPackages: ["geoip-lite"],
  async rewrites() {
    if (process.env.EXTERNAL_API) {
      const apiBase = process.env.EXTERNAL_API;
      return [
        {
          source: "/api/:path*",
          destination: `${apiBase}/api/:path*`,
        },
      ];
    }
    return [
      {
        source: "/.well-known/:path*",
        destination: "/api/.well-known/:path*",
      },
    ];
  },
};

export default nextConfig;
