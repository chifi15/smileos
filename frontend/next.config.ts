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
  async redirects() {
    return [
      {
        source: "/auth/google/callback",
        destination: "/google-callback",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
