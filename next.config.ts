import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The old env-priced sponsor page is superseded by /promote (DB-driven
      // pricing); the route file is root-owned so it's retired here instead.
      {
        source: "/sponsor",
        destination: "/promote",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
