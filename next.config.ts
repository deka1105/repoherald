import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root to this app. Left to infer, Next walks up to the
  // stray package.json in the home directory (see the workspace CLAUDE.md) and
  // picks the wrong root for file tracing.
  turbopack: { root: dirname(fileURLToPath(import.meta.url)) },
  async redirects() {
    return [
      // The old env-priced sponsor flow was replaced by /promote (DB-driven
      // pricing). Its route and action are deleted; this keeps any bookmarked
      // or external /sponsor link working.
      {
        source: "/sponsor",
        destination: "/promote",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
