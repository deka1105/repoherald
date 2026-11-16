/**
 * Explore — the public feed, and the app's front door.
 *
 * No sign-in wall: the feed is public on the web too, and an app that demands
 * an account before it shows anything is rejected under Guideline 5.1.1(i).
 *
 * Posting a repo is an action, not a place, so it is a button here rather than
 * a tab: Material's floating action button on Android, a "+" in the navigation
 * bar on iOS, each where its platform's users expect the primary create action
 * to be. Both go to /post, which asks for sign-in itself if needed.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getFeed, type FeedRepo, type FeedFilters } from "@/api";
import { useAuth } from "@/auth";
import { useAppState } from "@/app-state";
import { RepoCard } from "@/components/repo-card";
import { Column, Loading, Segments } from "@/components/ui";
import { C, CONTENT_MAX_WIDTH } from "@/theme";

/** The sort options the web's filter bar offers. */
const SORTS = [
  { key: undefined, label: "Top" },
  { key: "donations" as const, label: "Most donated" },
] as const;

/**
 * Your balance, with a wallet glyph, opening the Wallet.
 *
 * It used to be a bare "100 credits" sitting where a filter would go, which
 * read as a status nobody had explained. The icon says what it is and the tap
 * says where to find out more — the Wallet tab it replaced.
 */
function CreditsChip({ balance }: { balance: number }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/wallet")}
      hitSlop={6}
      style={({ pressed }) => [styles.credits, pressed && { opacity: 0.75 }]}
      accessibilityRole="button"
      accessibilityLabel={`${balance} ${balance === 1 ? "credit" : "credits"}`}
      accessibilityHint="Opens your wallet">
      <Ionicons name="wallet-outline" size={15} color={C.accent} />
      <Text style={styles.creditsText}>
        {balance} {balance === 1 ? "credit" : "credits"}
      </Text>
    </Pressable>
  );
}

/**
 * Material 3 extended FAB. Android only — iOS puts the same action in the
 * navigation bar. It sits inside the tab's content, which Android's native
 * tabs already inset above the bar, so `bottom: 16` is 16dp above it.
 */
function PostFab({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      android_ripple={{ color: "rgba(0,0,0,0.14)", foreground: true }}
      accessibilityRole="button"
      accessibilityLabel="Post a repo">
      <Ionicons name="add" size={24} color={C.onAccent} />
      <Text style={styles.fabLabel}>Post</Text>
    </Pressable>
  );
}

export default function ExploreScreen() {
  const { me } = useAuth();
  const { hidden, moderate } = useAppState();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<FeedRepo[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [sort, setSort] = useState<FeedFilters["sort"]>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtering here rather than in `load` keeps the cursor and the server's
  // page boundaries untouched — a blocked owner simply never renders.
  const visible = items.filter((r) => !hidden(r.fullName));

  const load = useCallback(
    async (reset: boolean, nextSort = sort) => {
      try {
        const res = await getFeed(reset ? undefined : (cursor ?? undefined), {
          sort: nextSort,
        });
        setError(null);
        const incoming = [...res.pinned, ...res.items];
        setItems((prev) => (reset ? incoming : [...prev, ...res.items]));
        setCursor(res.nextCursor);
      } catch {
        // Keep whatever is already on screen; a failed page must not blank
        // the feed.
        setError("Couldn't reach repoherald.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [cursor, sort]
  );

  // The first page, once. `load` is async and awaits getFeed before it touches
  // state, so nothing is set synchronously here — but the rule cannot see
  // through the call boundary, hence the second disable.
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { load(true); }, []);

  const changeSort = (next: FeedFilters["sort"]) => {
    if (next === sort) return;
    setSort(next);
    setItems([]);
    setCursor(null);
    setLoading(true);
    load(true, next);
  };

  const openPost = () => router.push("/post");

  // Scrolls with the feed and sticks at the top: one row, never wrapping, with
  // the sort control taking the width and the balance pinned at the end.
  const filters = (
    <View style={styles.filterOuter}>
      <Column style={styles.filters}>
        <Segments options={SORTS} value={sort} onChange={changeSort} label="Sort" />
        {me ? <CreditsChip balance={me.creditBalance} /> : null}
      </Column>
    </View>
  );

  return (
    <View style={styles.root}>
      {Platform.OS === "ios" ? (
        // A native bar button item, so on iOS 26 it gets the glass capsule the
        // system draws around its own; a Pressable in `headerRight` would not.
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon="plus"
            accessibilityLabel="Post a repo"
            onPress={openPost}
          />
        </Stack.Toolbar>
      ) : null}

      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(r, i) => `${r.id}-${i}`}
          renderItem={({ item }) => <RepoCard repo={item} onMore={moderate} />}
          ListHeaderComponent={filters}
          stickyHeaderIndices={[0]}
          contentContainerStyle={[
            styles.list,
            // Android: clear the extended FAB. iOS: the tab bar inset is
            // applied by the system through contentInsetAdjustmentBehavior.
            { paddingBottom: Platform.OS === "android" ? 96 + insets.bottom : 24 },
          ]}
          contentInsetAdjustmentBehavior="automatic"
          onEndReachedThreshold={0.6}
          onEndReached={() => { if (cursor) load(false); }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={C.dim}
              onRefresh={() => {
                setRefreshing(true);
                setCursor(null);
                load(true);
              }}
            />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              {error ??
                // Distinguish an empty feed from one the viewer has emptied
                // themselves, or blocking looks like the app is broken.
                (items.length
                  ? "Everything here is from accounts you've blocked."
                  : "Nothing listed yet.")}
            </Text>
          }
          ListFooterComponent={
            error && visible.length ? <Text style={styles.empty}>{error}</Text> : null
          }
        />
      )}

      {Platform.OS === "android" ? <PostFab onPress={openPost} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  // Opaque, because it sticks: cards scroll under it, not through it. The rule
  // stretches edge to edge on iPad while the controls stay in the reading
  // column with the cards.
  filterOuter: {
    backgroundColor: C.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
    marginHorizontal: -16,
    marginBottom: 12,
  },
  filters: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  credits: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    minHeight: 36,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    backgroundColor: C.card,
  },
  creditsText: { color: C.text, fontSize: 13, fontWeight: "600" },
  list: {
    paddingHorizontal: 16,
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
  },
  empty: { color: C.dim, textAlign: "center", marginTop: 48, fontSize: 14 },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    minHeight: 56,
    paddingHorizontal: 20,
    paddingLeft: 16,
    borderRadius: 16,
    backgroundColor: C.accent,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    elevation: 6,
    overflow: "hidden",
  },
  fabPressed: { transform: [{ scale: 0.97 }] },
  fabLabel: { color: C.onAccent, fontSize: 15, fontWeight: "700" },
});
