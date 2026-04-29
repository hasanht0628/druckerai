import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ["lh3.googleusercontent.com"],
  },
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
