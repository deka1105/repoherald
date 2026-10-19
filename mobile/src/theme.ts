import { Platform, StatusBar } from "react-native";

/**
 * Top inset every full-bleed root has to apply itself on Android.
 *
 * Two react-native APIs do nothing on Android and both bit us:
 *   - `SafeAreaView` applies insets on iOS only; on Android it is a plain View.
 *   - `Modal`'s `presentationStyle="pageSheet"` is iOS-only, so the sign-in and
 *     account sheets render full-screen there and draw under the status bar.
 *
 * Result was the wordmark sitting on top of the system clock, and "Sign in" /
 * "Done" on top of the wifi and battery icons. From API 35 Android is
 * edge-to-edge by default, so this gets worse on new devices, not better.
 *
 * iOS needs none of this: it is 0 there, and `StatusBar.currentHeight` is
 * undefined on iOS anyway.
 */
export const ANDROID_TOP_INSET =
  Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0;

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
