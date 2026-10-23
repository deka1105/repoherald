/**
 * repoherald — the website, on a phone.
 *
 * Deliberately not a wrapper around the website: every screen here is native,
 * over the mobile API at /api/mobile/v1. App Store review rejects web wrappers
 * under Guideline 4.2, and a WebView would also be worse.
 *
 * Credits can be *earned* here but not bought, and there is no sponsorship
 * flow. Selling a digital currency outside In-App Purchase is a Guideline
 * 3.1.1 rejection, so purchasing stays on the web — and the app does not link
 * to it either.
 */
import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { Stack, ThemeProvider } from "expo-router";
import { ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/auth";
import { AppStateProvider } from "@/app-state";
import { NAV_THEME } from "@/theme";
import { CLERK_PUBLISHABLE_KEY } from "@/config";

// Held until Clerk has decided whether this launch is signed in, so the app
// never appears with its account controls in one shape and then visibly
// changes them a beat later.
SplashScreen.preventAutoHideAsync().catch(() => {});

function Navigator() {
  const { loading } = useAuth();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: NAV_THEME.colors.background },
        headerTintColor: NAV_THEME.colors.primary as string,
        headerTitleStyle: { color: NAV_THEME.colors.text as string },
        contentStyle: { backgroundColor: NAV_THEME.colors.background },
      }}>
      {/* The tab bar is the app's chrome; a stack header above it would be a
          second title bar saying the same thing. */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="repo/[id]" options={{ title: "Repo" }} />
      <Stack.Screen name="list/[slug]" options={{ title: "List" }} />
      <Stack.Screen name="support" options={{ title: "Support" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <AuthProvider>
        <AppStateProvider>
          <SafeAreaProvider>
            <ThemeProvider value={NAV_THEME}>
              <StatusBar style="light" />
              <Navigator />
            </ThemeProvider>
          </SafeAreaProvider>
        </AppStateProvider>
      </AuthProvider>
    </ClerkProvider>
  );
}
