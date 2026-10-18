/** The app is dark-only, matching app.json's userInterfaceStyle. */
export const C = {
  bg: "#0a090c",
  card: "#141317",
  line: "#26242b",
  text: "#f2f2f0",
  dim: "#8e8c95",
  body: "#b9b7c0",
  accent: "#9d78ff",
  danger: "#ff6b6b",
};

/**
 * Caps the reading column on iPad.
 *
 * app.json keeps `supportsTablet: true`, so the feed is reviewed on a 13"
 * screen. Without this the cards stretch the full width and a repo description
 * runs to a single 1300px line, which reads as an unconverted phone app.
 */
export const CONTENT_MAX_WIDTH = 720;
