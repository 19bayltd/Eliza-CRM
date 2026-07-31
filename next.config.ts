import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  eslint: {
    // Lint runs as its own verification step (`npm run lint`).
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
