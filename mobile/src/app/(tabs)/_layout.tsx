/**
 * The bottom tab bar — the same six destinations the website shows on a phone
 * (`src/components/mobile-nav.tsx` there), minus the two that cannot ship.
 *
 * Sponsor is absent because it sells placement, and Admin is absent because a
 * consumer binary should not carry the moderation portal: a reviewer cannot
 * reach it, and shipping it would widen the privacy and metadata surface for
 * no one's benefit.
 *
 * Every tab is reachable signed out. Tabs that need an account say so on the
 * screen and offer sign-in there, rather than vanishing — a tab bar that
 * changes shape when you sign in is disorienting, and hiding a tab at runtime
 * remounts the navigator and resets everyone's scroll position.
 */
import React from "react";
import { type ColorValue } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { C } from "@/theme";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

// The navigator hands the icon a ColorValue, which is wider than the string
// @expo/vector-icons takes — the extra members are platform-opaque colours the
// tab bar never produces, so this narrows rather than converts.
function icon(name: IoniconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} color={color as string} size={size} />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.dim,
        tabBarStyle: { backgroundColor: C.bg, borderTopColor: C.line },
        tabBarLabelStyle: { fontSize: 11 },
        headerStyle: { backgroundColor: C.bg },
        headerTintColor: C.text,
        headerTitleStyle: { color: C.text, fontWeight: "700" },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: C.bg },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: "Explore", tabBarIcon: icon("compass-outline") }}
      />
      <Tabs.Screen
        name="search"
        options={{ title: "Search", tabBarIcon: icon("search-outline") }}
      />
      <Tabs.Screen
        name="post"
        options={{ title: "Post", tabBarIcon: icon("add-circle-outline") }}
      />
      <Tabs.Screen
        name="lists"
        options={{ title: "Lists", tabBarIcon: icon("list-outline") }}
      />
      <Tabs.Screen
        name="wallet"
        options={{ title: "Wallet", tabBarIcon: icon("wallet-outline") }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: "Account", tabBarIcon: icon("person-outline") }}
      />
    </Tabs>
  );
}
