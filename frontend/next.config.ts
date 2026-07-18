import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "objectstorage.*.oraclecloud.com",
      },
    ],
  },
};

export default nextConfig;
