import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow PDF iframes from FastAPI backend
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
