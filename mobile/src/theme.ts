import {
  Platform,
  PlatformColor,
  StatusBar,
  type ColorValue,
} from "react-native";
import { DarkTheme, type NativeStackNavigationOptions } from "expo-router";
import { isLiquidGlassAvailable } from "expo-glass-effect";

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

/**
 * Material You: on Android 12 and later the accent follows the wallpaper.
 *
 * The system publishes its tonal palettes as colour resources, and
 * `PlatformColor` reads them without a native module. Tones are picked the way
 * Material 3's dark scheme picks them — primary is tone 80 (`_200`), what sits
 * on it is tone 20 (`_800`) — so the pair clears 4.5:1 by construction whatever
 * the wallpaper. Below API 31 the resources do not exist, so the brand purple
 * stays. iOS always gets the brand: there is no system accent to follow.
 */
export const MATERIAL_YOU =
  Platform.OS === "android" &&
  typeof Platform.Version === "number" &&
  Platform.Version >= 31;

const sys = (name: string): ColorValue => PlatformColor(`@android:color/${name}`);

/** The brand purple and the ink that sits on it — the fallback everywhere
 *  dynamic colour is unavailable, and the only colour React Navigation's theme
 *  can take, since it wants a string rather than a ColorValue. */
export const BRAND_ACCENT = "#9d78ff";
const BRAND_ON_ACCENT = "#120b24";

/**
 * The app is dark-only, matching app.json's userInterfaceStyle.
 *
 * Contrast floors, measured against both `bg` and `card` (WCAG 2.x):
 *   - `dim` is the secondary text colour — 6.5:1 on `card`, 7.0:1 on `bg`.
 *     Raised from #8e8c95 (5.6:1) so the 12px language and view-count labels
 *     clear AA with margin rather than sitting on the line.
 *   - `faint` is for non-text controls only (the card's overflow glyph):
 *     3.4:1 on `card`, which clears the 3:1 floor for UI components but would
 *     fail for text. Never use it for words.
 */
export const C = {
  bg: "#0a090c",
  card: "#141317",
  line: "#26242b",
  text: "#f2f2f0",
  dim: "#9a98a3",
  faint: "#6b6975",
  body: "#b9b7c0",
  accent: MATERIAL_YOU ? sys("system_accent1_200") : BRAND_ACCENT,
  onAccent: MATERIAL_YOU ? sys("system_accent1_800") : BRAND_ON_ACCENT,
  danger: "#ff6b6b",
} satisfies Record<string, ColorValue>;

/**
 * Corner radii, per platform.
 *
 * Material 3 Expressive wants larger corners (24dp cards) and squircle
 * avatars (see `avatarRadius`);
 * iOS 26 keeps tighter card corners but its own controls are capsules. Both
 * platforms get capsule buttons and chips, which is what each design language
 * now draws its own as.
 */
export const R = {
  card: Platform.select({ android: 24, default: 16 }) as number,
  control: 12,
  pill: 999,
};

/**
 * An avatar's corner radius for its size. Android gets a squircle-like
 * rounded square (30% of the side, the M3 Expressive avatar shape) rather
 * than a circle; iOS keeps its 10pt rounded square.
 */
export const avatarRadius = (size: number) =>
  Platform.OS === "android" ? Math.round(size * 0.3) : 10;

/**
 * Caps the reading column on iPad.
 *
 * app.json keeps `supportsTablet: true`, so the feed is reviewed on a 13"
 * screen. Without this the cards stretch the full width and a repo description
 * runs to a single 1300px line, which reads as an unconverted phone app.
 */
export const CONTENT_MAX_WIDTH = 720;

/**
 * The navigator theme.
 *
 * Supplied explicitly rather than left to default: React Navigation's default
 * is light, and the flash of a white screen behind a dark app during a push
 * transition is the single most common complaint about this setup. Built on
 * DarkTheme so a field added to the theme shape in a later SDK still has a
 * sensible value here.
 */
export const NAV_THEME: ReactNavigation.Theme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: BRAND_ACCENT,
    background: C.bg,
    card: C.bg,
    text: C.text,
    border: C.line,
    notification: C.danger,
  },
};

/**
 * True on iOS 26 and later, where the system draws tab and navigation bars as
 * Liquid Glass. Everything that would otherwise paint a bar background checks
 * this, because a painted background is exactly what turns the glass off.
 */
export const LIQUID_GLASS = Platform.OS === "ios" && isLiquidGlassAvailable();

/**
 * Header options shared by every Stack in the app.
 *
 * On iOS the header is left transparent and nothing is painted behind it: the
 * system supplies the material (Liquid Glass on 26, a chrome blur before it,
 * added here because a transparent bar over scrolling cards is unreadable
 * without one). The scroll views underneath use
 * `contentInsetAdjustmentBehavior="automatic"`, so content starts below the
 * bar and slides under it as you scroll — the behaviour the system's own apps
 * have. On Android a Material top app bar is a solid surface, so it is
 * painted in the page colour as before.
 */
export const STACK_SCREEN_OPTIONS: NativeStackNavigationOptions = Platform.select({
  ios: {
    headerTransparent: true,
    headerBlurEffect: LIQUID_GLASS ? undefined : "systemChromeMaterialDark",
    headerTintColor: BRAND_ACCENT,
    headerTitleStyle: { color: C.text },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: C.bg },
  },
  default: {
    headerStyle: { backgroundColor: C.bg },
    headerTintColor: C.text,
    headerTitleStyle: { color: C.text, fontWeight: "700" },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: C.bg },
  },
});
