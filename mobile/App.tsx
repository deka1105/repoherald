/**
 * repoherald — the feed, on a phone.
 *
 * Deliberately not a wrapper around the website: the feed, repo detail and
 * account are native screens over the mobile API. App Store review rejects
 * web wrappers under Guideline 4.2, and a WebView would also be worse.
 *
 * Credits can be *earned* here but not bought. Selling a digital currency
 * outside In-App Purchase is a Guideline 3.1.1 rejection, so the purchase
 * flow stays on the web until IAP is wired up.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, FlatList, Linking, Pressable, RefreshControl,
  SafeAreaView, StatusBar, StyleSheet, Text, View,
} from "react-native";
import { Image } from "expo-image";
import { AuthProvider, useAuth } from "./src/auth";
import { getFeed, type FeedRepo } from "./src/api";

const C = {
  bg: "#0a090c", card: "#141317", line: "#26242b",
  text: "#f2f2f0", dim: "#8e8c95", accent: "#9d78ff",
};

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
          <Text style={styles.repoName} numberOfLines={1}>{repo.name}</Text>
          <Text style={styles.owner} numberOfLines={1}>{repo.ownerLogin}</Text>
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
  const { me, loading: authLoading, signIn, signOut } = useAuth();
  const [items, setItems] = useState<FeedRepo[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (reset: boolean) => {
    try {
      setError(null);
      const res = await getFeed(reset ? undefined : cursor ?? undefined);
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

  useEffect(() => { load(true); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={styles.bar}>
        <Text style={styles.logo}>REPOHERALD</Text>
        {authLoading ? null : me ? (
          <Pressable onPress={signOut} accessibilityRole="button">
            <Text style={styles.credits}>{me.creditBalance} credits</Text>
          </Pressable>
        ) : (
          <Pressable onPress={signIn} accessibilityRole="button">
            <Text style={styles.signIn}>Sign in</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.centre}><ActivityIndicator color={C.accent} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r, i) => `${r.id}-${i}`}
          renderItem={({ item }) => <RepoCard repo={item} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
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
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Feed />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  centre: { flex: 1, alignItems: "center", justifyContent: "center" },
  bar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line,
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
  desc: { color: "#b9b7c0", fontSize: 14, lineHeight: 20, marginTop: 12 },
  lang: { color: C.dim, fontSize: 12, marginTop: 10, letterSpacing: 0.5 },
  empty: { color: C.dim, textAlign: "center", marginTop: 48, fontSize: 14 },
});
