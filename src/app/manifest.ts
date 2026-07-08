import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest — makes the site installable as a
// standalone app (Add to Home Screen / PWA).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "repoherald",
    short_name: "repoherald",
    description:
      "Post your repos, earn highlight time for the repos you star, and discover what's worth starring.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfbfa",
    theme_color: "#fbfbfa",
    icons: [
      {
        src: "/brand/shield-black.png",
        sizes: "155x178",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
