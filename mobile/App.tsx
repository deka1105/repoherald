/**
 * repoherald — the feed, on a phone.
 *
 * Deliberately not a wrapper around the website: the feed, repo detail and
 * account are native screens over the mobile API. App Store review rejects
 * web wrappers under Guideline 4.2, and a WebView would also be worse.
 *
 * Credits can be *earned* here but not bought. Selling a digital currency
 * outside In-App Purchase is a Guideline 3.1.1 rejection, so the purchase
 * flow stays on the web until IAP is wired up — and the app does not link to
 * it either.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, FlatList, Linking, Pressable, RefreshControl,
  SafeAreaView, StatusBar, StyleSheet, Text, View,
} from "react-native";
import { Image } from "expo-image";
import * as SplashScreen from "expo-splash-screen";
import { ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { AuthProvider, useAuth } from "./src/auth";
import { getFeed, type FeedRepo } from "./src/api";
import { AccountSheet } from "./src/account";
import { SignInSheet } from "./src/signin";
import { C, CONTENT_MAX_WIDTH } from "./src/theme";
import { CLERK_PUBLISHABLE_KEY } from "./src/config";

// Held until the feed's first paint, so the app never shows an empty list that
// fills in a moment later.
SplashScreen.preventAutoHideAsync().catch(() => {});

/** "owner/name" is all the API sends, so the card derives both halves from it.
 *  Falls back to the whole string rather than rendering an empty title if a
 *  listing ever arrives without a slash. */
const repoOwner = (fullName: string) => fullName.split("/")[0] ?? fullName;
const repoName = (fullName: string) => fullName.split("/")[1] ?? fullName;

function RepoCard({ repo }: { repo: FeedRepo }) {
  return (
    <Pressable
      style={styles.card}
      onPress={() => Linking.openURL(`https://github.com/${repo.fullName}`)}
      accessibilityRole="link"
      accessibilityLabel={`${repo.fullName} on GitHub`}>
      <View style={styles.cardHead}>
        {repo.avatarUrl ? (
          <Image source={{ uri: repo.avatarUrl }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, { backgroundColor: C.line }]} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.repoName} numberOfLines={1}>{repoName(repo.fullName)}</Text>
          <Text style={styles.owner} numberOfLines={1}>{repoOwner(repo.fullName)}</Text>
        </View>
        <Text style={styles.stars}>★ {repo.starsCount.toLocaleString()}</Text>
      </View>
      {repo.description ? (
        <Text style={styles.desc} numberOfLines={3}>{repo.description}</Text>
      ) : null}
      {repo.primaryLanguage ? (
        <Text style={styles.lang}>{repo.primaryLanguage}</Text>
      ) : null}
    </Pressable>
  );
}

function Feed() {
  const { me, loading: authLoading } = useAuth();
  const [items, setItems] = useState<FeedRepo[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAccount, setShowAccount] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);

  const load = useCallback(async (reset: boolean) => {
    try {
      const res = await getFeed(reset ? undefined : cursor ?? undefined);
      setError(null);
      const incoming = [...res.pinned, ...res.items];
      setItems((prev) => (reset ? incoming : [...prev, ...res.items]));
      setCursor(res.nextCursor);
    } catch {
      // Keep whatever is already on screen; a failed page must not blank the feed.
      setError("Couldn't reach repoherald.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cursor]);

  // The first page, once. `load` is async and awaits getFeed before it touches
  // state, so nothing is set synchronously here — but the rule cannot see
  // through the call boundary, hence the second disable.
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { load(true); }, []);

  // Both gates must clear before the splash lifts: the feed has content, and
  // Clerk has decided whether this launch is signed in — otherwise the account
  // button visibly changes shape a beat after the app appears.
  useEffect(() => {
    if (!loading && !authLoading) SplashScreen.hideAsync().catch(() => {});
  }, [loading, authLoading]);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={styles.barOuter}>
        <View style={styles.bar}>
          <Text style={styles.logo}>REPOHERALD</Text>
          {authLoading ? null : me ? (
            <Pressable
              onPress={() => setShowAccount(true)}
              accessibilityRole="button"
              accessibilityLabel={`Account — ${me.creditBalance} credits`}
              hitSlop={10}>
              <Text style={styles.credits}>{me.creditBalance} credits</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setShowSignIn(true)}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
              hitSlop={10}>
              <Text style={styles.signIn}>Sign in</Text>
            </Pressable>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.centre}><ActivityIndicator color={C.accent} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r, i) => `${r.id}-${i}`}
          renderItem={({ item }) => <RepoCard repo={item} />}
          contentContainerStyle={styles.list}
          onEndReachedThreshold={0.6}
          onEndReached={() => { if (cursor) load(false); }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={C.dim}
              onRefresh={() => { setRefreshing(true); setCursor(null); load(true); }}
            />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>{error ?? "Nothing listed yet."}</Text>
          }
          ListFooterComponent={
            error && items.length ? <Text style={styles.empty}>{error}</Text> : null
          }
        />
      )}

      <AccountSheet visible={showAccount} onClose={() => setShowAccount(false)} />
      <SignInSheet visible={showSignIn} onClose={() => setShowSignIn(false)} />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <AuthProvider>
        <Feed />
      </AuthProvider>
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  centre: { flex: 1, alignItems: "center", justifyContent: "center" },
  // The rule stretches edge to edge on iPad while the content inside it stays
  // in the reading column with the cards.
  barOuter: {
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line,
  },
  bar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center",
  },
  list: {
    padding: 16, paddingBottom: 48,
    width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center",
  },
  logo: { color: C.text, fontSize: 14, fontWeight: "800", letterSpacing: 3 },
  signIn: { color: C.accent, fontSize: 15, fontWeight: "600" },
  credits: { color: C.dim, fontSize: 14 },
  card: {
    backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.line,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 38, height: 38, borderRadius: 10 },
  repoName: { color: C.text, fontSize: 16, fontWeight: "700" },
  owner: { color: C.dim, fontSize: 13, marginTop: 1 },
  stars: { color: C.dim, fontSize: 13 },
  desc: { color: C.body, fontSize: 14, lineHeight: 20, marginTop: 12 },
  lang: { color: C.dim, fontSize: 12, marginTop: 10, letterSpacing: 0.5 },
  empty: { color: C.dim, textAlign: "center", marginTop: 48, fontSize: 14 },
});
