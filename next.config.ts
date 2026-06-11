import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/proxy-cats',
        destination: 'https://ratul-api-all-in-one.onrender.com/event-cats',
      },
      {
        source: '/api/proxy-matches',
        destination: 'https://ratul-api-all-in-one.onrender.com/get-data/categories/live-events.txt',
      }
    ];
  },
};

export default nextConfig;
