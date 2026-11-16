/**
 * The Stack inside each tab.
 *
 * A native tab bar draws no header, so every tab is a folder whose `_layout`
 * returns one of these: a single-screen Stack that supplies the title bar
 * (Liquid Glass on iOS 26, a solid Material top app bar on Android) and gives
 * the screen somewhere to put header items — the "+" on Explore, the search
 * field on Search. Screens reached from a tab are pushed on the *root* Stack
 * (see `src/app/_layout.tsx`), over the tab bar, so this one never grows.
 */
import React from "react";
import { Stack } from "expo-router";
import { STACK_SCREEN_OPTIONS } from "@/theme";

export function TabStack({ title }: { title: string }) {
  return (
    <Stack screenOptions={STACK_SCREEN_OPTIONS}>
      <Stack.Screen name="index" options={{ title }} />
    </Stack>
  );
}
