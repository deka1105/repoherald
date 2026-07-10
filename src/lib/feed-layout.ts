// Feed layout preference. Stored in a cookie (not localStorage) so the server
// renders the feed in the chosen layout with no flash. Set client-side by the
// chooser in account settings; read by the server feed (FeedHome).

export type FeedLayout = "banners" | "tiles" | "hybrid";

export const FEED_LAYOUTS: {
  id: FeedLayout;
  label: string;
  description: string;
}[] = [
  {
    id: "banners",
    label: "Banners",
    description: "Full-width cards with descriptions.",
  },
  {
    id: "tiles",
    label: "Tiles",
    description: "Compact square tiles in a grid.",
  },
  {
    id: "hybrid",
    label: "Hybrid",
    description: "Sponsored as banners, the rest as tiles.",
  },
];

export const DEFAULT_FEED_LAYOUT: FeedLayout = "banners";
export const FEED_LAYOUT_COOKIE = "rh_feed_layout";

export function isFeedLayout(v: string | null | undefined): v is FeedLayout {
  return v === "banners" || v === "tiles" || v === "hybrid";
}

export function parseFeedLayout(v: string | null | undefined): FeedLayout {
  return isFeedLayout(v) ? v : DEFAULT_FEED_LAYOUT;
}
