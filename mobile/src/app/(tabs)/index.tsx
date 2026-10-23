/**
 * Explore — the public feed, and the app's front door.
 *
 * No sign-in wall: the feed is public on the web too, and an app that demands
 * an account before it shows anything is rejected under Guideline 5.1.1(i).
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
import { Stack } from "expo-router";
import { getFeed, type FeedRepo, type FeedFilters } from "@/api";
import { useAuth } from "@/auth";
import { useAppState } from "@/app-state";
import { RepoCard } from "@/components/repo-card";
import { Column, Loading } from "@/components/ui";
import { C, CONTENT_MAX_WIDTH } from "@/theme";

/** The sort options the web's filter bar offers. */
const SORTS = [
  { key: undefined, label: "Top" },
  { key: "donations" as const, label: "Most donated" },
];

export default function ExploreScreen() {
  const { me } = useAuth();
  const { hidden, moderate } = useAppState();

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

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: "Explore" }} />

      <View style={styles.filterOuter}>
        <Column style={styles.filters}>
          {SORTS.map((s) => (
            <Pressable
              key={s.label}
              onPress={() => changeSort(s.key)}
              style={[styles.chip, sort === s.key && styles.chipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: sort === s.key }}
              accessibilityLabel={`Sort by ${s.label}`}>
              <Text style={[styles.chipText, sort === s.key && styles.chipTextOn]}>
                {s.label}
              </Text>
            </Pressable>
          ))}
          {me ? (
            <Text style={styles.credits}>{me.creditBalance} credits</Text>
          ) : null}
        </Column>
      </View>

      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(r, i) => `${r.id}-${i}`}
          renderItem={({ item }) => <RepoCard repo={item} onMore={moderate} />}
          contentContainerStyle={styles.list}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  // The rule stretches edge to edge on iPad while the content inside it stays
  // in the reading column with the cards.
  filterOuter: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  filters: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: C.dim, fontSize: 13, fontWeight: "600" },
  chipTextOn: { color: "#120b24" },
  credits: { color: C.dim, fontSize: 13, marginLeft: "auto" },
  list: {
    padding: 16,
    // Clears the tab bar, which overlays the end of a scroll view.
    paddingBottom: Platform.OS === "android" ? 112 : 96,
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
  },
  empty: { color: C.dim, textAlign: "center", marginTop: 48, fontSize: 14 },
});
