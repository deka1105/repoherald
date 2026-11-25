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
 *
 * Structure: the four tabs live in `(tabs)`, each with a Stack of its own so it
 * carries a native header. Everything that is reached *from* a tab rather than
 * being one — a repo, a list, the wallet, posting, identifying, support — is a
 * screen on this root Stack, pushed over the tab bar. Paths are unchanged from
 * when Wallet, Post and Identify were tabs (`/wallet`, `/post`, `/identify`),
 * so no deep link moved.
 */
import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { Stack, ThemeProvider, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { ShareIntentProvider, useShareIntentContext } from "expo-share-intent";
import { ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/auth";
import { AppStateProvider } from "@/app-state";
import { NAV_THEME, STACK_SCREEN_OPTIONS } from "@/theme";
import { CLERK_PUBLISHABLE_KEY } from "@/config";
import { pathFromNotification, registerForPush } from "@/push";

// Held until Clerk has decided whether this launch is signed in, so the app
// never appears with its account controls in one shape and then visibly
// changes them a beat later.
SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Something shared to repoherald from another app (Safari, GitHub, X…) opens
 * Identify with the text prefilled. Identify rather than Post because most of
 * what people share is somebody else's repo, which Post would refuse; Identify
 * finds it whoever owns it.
 */
function ShareIntentHandler() {
  const router = useRouter();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();

  useEffect(() => {
    if (!hasShareIntent) return;
    const text = [shareIntent.meta?.title, shareIntent.webUrl ?? shareIntent.text]
      .filter((s): s is string => !!s && s.trim().length > 0)
      .join("\n")
      .slice(0, 2000);
    resetShareIntent();
    if (text) router.push({ pathname: "/identify", params: { caption: text } });
  }, [hasShareIntent, shareIntent, resetShareIntent, router]);

  return null;
}

/** Registers for push once signed in, and opens what a tapped notification points at. */
function PushHandler() {
  const router = useRouter();
  const { me } = useAuth();
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (me) registerForPush();
  }, [me]);

  useEffect(() => {
    const path = pathFromNotification(response);
    if (!path) return;
    router.push(path as never);
    Notifications.clearLastNotificationResponseAsync().catch(() => {});
  }, [response, router]);

  return null;
}

function Navigator() {
  const { loading } = useAuth();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  return (
    <>
    <ShareIntentHandler />
    <PushHandler />
    <Stack screenOptions={STACK_SCREEN_OPTIONS}>
      {/* Each tab draws its own header, so the root draws none over them. The
          title is still needed: a pushed screen's back button takes its label
          from the screen it came from, and without one the button reads
          "(tabs)" — the route group's folder name, leaking into the UI on
          every repo, list and support screen. */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "Back" }} />
      <Stack.Screen name="repo/[id]" options={{ title: "Repo" }} />
      <Stack.Screen name="list/[slug]" options={{ title: "List" }} />
      <Stack.Screen name="wallet" options={{ title: "Wallet" }} />
      <Stack.Screen name="post" options={{ title: "Post a repo" }} />
      <Stack.Screen name="identify" options={{ title: "Identify" }} />
      <Stack.Screen name="support" options={{ title: "Support" }} />
    </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    // ShareIntentProvider has to be outermost: it reads the launch URL before
    // anything else can consume it.
    <ShareIntentProvider>
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
    </ShareIntentProvider>
  );
}
