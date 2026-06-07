import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false, // Prevents Leaflet double-mount in dev
};

export default nextConfig;
