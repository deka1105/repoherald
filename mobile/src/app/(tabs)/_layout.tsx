/**
 * The bottom tab bar: four destinations, drawn by the system.
 *
 * Native, not JavaScript. `NativeTabs` is a real UITabBarController on iOS and
 * a Material 3 BottomNavigationView on Android, which is the one change that
 * gets Liquid Glass on iOS 26 (the bar is translucent, minimises on scroll,
 * follows the user's transparency setting) and the Material pill indicator on
 * Android without a second visual system being drawn here. Nothing paints a
 * background behind the bar on iOS — a painted background is exactly what
 * turns the glass off.
 *
 * Four, down from seven. Apple's HIG caps a tab bar at five and Material says
 * three to five; at seven the labels were shrinking to fit. The three that
 * left were not destinations:
 *   - Post is an action, so it is a button — a FAB on Android, a "+" in the
 *     Explore header on iOS — and lives at /post.
 *   - Identify is a way of searching, so it is reached from Search (and from
 *     the empty state of a failed search) and lives at /identify.
 *   - Wallet is read-only and visited rarely, so it sits under Account, and the
 *     credit chip on Explore opens it directly. It lives at /wallet.
 * Their paths did not change, so no deep link broke.
 *
 * Every tab is reachable signed out. Tabs that need an account say so on the
 * screen and offer sign-in there, rather than vanishing — a tab bar that
 * changes shape when you sign in is disorienting, and hiding a native tab at
 * runtime remounts the navigator and resets everyone's scroll position.
 *
 * Each tab is a folder with its own Stack (`_layout.tsx`), because a native
 * tab bar has no header of its own: the Stack supplies the title bar, and on
 * iOS 26 that bar is glass too.
 */
import React from "react";
import { Platform, PlatformColor, type ColorValue } from "react-native";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { BRAND_ACCENT, C, MATERIAL_YOU } from "@/theme";

/**
 * Android bar colours, Material 3 dark scheme roles.
 *
 * With Material You the roles come from the wallpaper palettes the system
 * publishes: the indicator is `secondaryContainer` (accent2, tone 30), the
 * selected glyph `onSecondaryContainer` (accent2, tone 90), the rest
 * `onSurfaceVariant` (neutral2, tone 80). Without it, the brand stands in.
 * iOS ignores all of these on 26 and takes only the tint before it.
 */
const sys = (name: string): ColorValue => PlatformColor(`@android:color/${name}`);
const ANDROID = MATERIAL_YOU
  ? {
      indicator: sys("system_accent2_700"),
      selected: sys("system_accent2_100"),
      idle: sys("system_neutral2_200"),
      ripple: sys("system_accent2_700"),
    }
  : {
      indicator: "#2f2550",
      selected: C.text,
      idle: C.dim,
      ripple: "#2f2550",
    };

export default function TabsLayout() {
  const android = Platform.OS === "android";
  return (
    <NativeTabs
      // iOS before 26 still draws a bar it can tint; on 26 the system owns the
      // bar's material and these set only the selected colour.
      tintColor={android ? undefined : BRAND_ACCENT}
      iconColor={android ? { default: ANDROID.idle, selected: ANDROID.selected } : undefined}
      labelStyle={
        android
          ? { default: { color: ANDROID.idle }, selected: { color: ANDROID.selected } }
          : undefined
      }
      backgroundColor={android ? C.card : undefined}
      indicatorColor={ANDROID.indicator}
      rippleColor={ANDROID.ripple}
      // Four destinations: Material's "auto" would label only the selected one.
      labelVisibilityMode="labeled"
      // iOS 26: the bar shrinks to the selected item as the feed scrolls down
      // and comes back on the way up, like the system's own apps.
      minimizeBehavior="onScrollDown"
      sidebarAdaptable>
      <NativeTabs.Trigger name="(explore)">
        <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "safari", selected: "safari.fill" }}
          md="explore"
        />
      </NativeTabs.Trigger>
      {/* `role="search"` makes this the system search tab on iOS 26: set apart
          at the trailing edge, where the bottom-anchored search field of the
          system apps now lives. Before 26 it is an ordinary tab. */}
      <NativeTabs.Trigger name="search" role="search">
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="lists">
        <NativeTabs.Trigger.Label>Lists</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "list.bullet.rectangle", selected: "list.bullet.rectangle.fill" }}
          md="list_alt"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Label>Account</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }}
          md="account_circle"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
