/**
 * Search — "where did I put that?"
 *
 * Two sources, and the line between them is the point of the screen: your own
 * lists first, then the public feed. A repo you filed from a DM is written
 * `hidden`, so it never appears in the public half; it surfaces here for you
 * and for nobody else. The server enforces that split (`src/lib/search.ts`);
 * this screen only has to label which half a result came from.
 *
 * Identify lives behind this tab too. Working out which repository a post was
 * about is a way of searching, so its door is here — offered when there is
 * nothing to search yet, and again when a search finds nothing — rather than
 * being a tab of its own.
 *
 * The field itself is native on iOS: `Stack.SearchBar` puts it in the system's
 * search bar, which on iOS 26 is where the search tab's field lives and sits
 * at the bottom near the thumbs. Android keeps a Material field at the top of
 * the content, which is where its users look for one.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ApiError, AuthError, search, type SearchResult } from "@/api";
import { useAuth } from "@/auth";
import { useAppState } from "@/app-state";
import { RepoCard } from "@/components/repo-card";
import { Loading } from "@/components/ui";
import { C, CONTENT_MAX_WIDTH, R } from "@/theme";

/** Matches the server's floor, so "go" and "ai" work but an empty box doesn't
 *  ask for the whole table. */
const MIN_QUERY = 2;
const DEBOUNCE_MS = 300;

/** The door to /identify. */
function IdentifyCard({ compact }: { compact?: boolean }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/identify")}
      style={({ pressed }) => [styles.identify, pressed && { opacity: 0.85 }]}
      android_ripple={{ color: "rgba(255,255,255,0.06)", foreground: true }}
      accessibilityRole="button"
      accessibilityLabel="Identify a repo from a post"
      accessibilityHint="Paste a caption, on-screen text or a transcript and find the repository it is about">
      <View style={styles.identifyIcon}>
        <Ionicons name="sparkles" size={18} color={C.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.identifyTitle}>Identify a repo from a post</Text>
        {compact ? null : (
          <Text style={styles.identifyBody}>
            Paste what a reel or post said and this works out which GitHub
            repository it was about — even when it never gave the name.
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={C.dim} />
    </Pressable>
  );
}

export default function SearchScreen() {
  const { me } = useAuth();
  const { hidden, moderate } = useAppState();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  // Identifies the most recent request. An earlier search that resolves late
  // must not overwrite a later one's results — on a phone that is the normal
  // case, not the rare one.
  const latest = useRef(0);

  const run = useCallback(async (q: string) => {
    const ticket = ++latest.current;
    if (q.trim().length < MIN_QUERY) {
      setResults([]);
      setSearched(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const res = await search(q);
      if (ticket !== latest.current) return;
      setResults(res.results);
      setError(null);
    } catch (e) {
      if (ticket !== latest.current) return;
      setResults([]);
      setError(
        e instanceof AuthError
          ? "Please sign in again."
          : e instanceof ApiError
            ? e.message
            : "Couldn't reach repoherald."
      );
    } finally {
      if (ticket === latest.current) {
        setSearching(false);
        setSearched(true);
      }
    }
  }, []);

  // Debounced: a character a keystroke would be a request a keystroke.
  useEffect(() => {
    const t = setTimeout(() => run(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, run]);

  const visible = results.filter((r) => !hidden(r.fullName));
  const mine = visible.filter((r) => r.where === "list");
  const open = visible.filter((r) => r.where === "public");
  const idle = query.trim().length < MIN_QUERY;

  return (
    <View style={styles.root}>
      {Platform.OS === "ios" ? (
        <Stack.SearchBar
          placeholder="Repos, languages, owners"
          onChangeText={(e) => setQuery(e.nativeEvent.text)}
          onSearchButtonPress={(e) => run(e.nativeEvent.text)}
          onCancelButtonPress={() => setQuery("")}
          autoCapitalize="none"
          hideWhenScrolling={false}
          textColor={C.text}
          hintTextColor={C.dim}
          tintColor={C.accent}
        />
      ) : (
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={C.dim} style={styles.searchGlyph} />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Repos, languages, owners"
            placeholderTextColor={C.dim}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            keyboardAppearance="dark"
            accessibilityLabel="Search repos"
            onSubmitEditing={() => run(query)}
          />
        </View>
      )}

      {searching && results.length === 0 ? (
        <Loading />
      ) : (
        <FlatList
          data={[...mine, ...open]}
          keyExtractor={(r) => `${r.where}-${r.id}`}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: 24 + (Platform.OS === "android" ? insets.bottom : 0) },
          ]}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={({ item, index }) => (
            <>
              {/* Section headers, rendered inline rather than with
                  SectionList: two fixed sections do not need a second list
                  type, and the empty one must disappear entirely. */}
              {index === 0 && mine.length > 0 ? (
                <Text style={styles.section}>In your lists</Text>
              ) : null}
              {index === mine.length && open.length > 0 ? (
                <Text style={styles.section}>On repoherald</Text>
              ) : null}
              <RepoCard
                repo={item}
                onMore={moderate}
                footer={
                  item.listTitle ? (
                    <Text style={styles.where}>{item.listTitle}</Text>
                  ) : null
                }
              />
            </>
          )}
          ListEmptyComponent={
            idle ? (
              <>
                <IdentifyCard />
                <Text style={styles.empty}>
                  {me
                    ? "Search the feed and everything in your own lists."
                    : "Search the feed. Sign in to also search your own lists."}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.empty}>
                  {error ?? (searched ? `Nothing matches “${query.trim()}”.` : "")}
                </Text>
                {searched && !error ? (
                  <>
                    <Text style={styles.hint}>
                      Saw it in a post and don&rsquo;t know the name?
                    </Text>
                    <IdentifyCard compact />
                  </>
                ) : null}
              </>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  searchBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
    position: "relative",
  },
  searchGlyph: { position: "absolute", left: 30, top: 22, zIndex: 1 },
  input: {
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    borderRadius: 999,
    paddingLeft: 42,
    paddingRight: 16,
    paddingVertical: 12,
    color: C.text,
    fontSize: 16,
    minHeight: 48,
  },
  list: {
    padding: 16,
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
  },
  section: {
    color: C.dim,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 10,
    marginTop: 4,
  },
  where: { color: C.accent, fontSize: 12 },
  empty: {
    color: C.dim,
    textAlign: "center",
    marginTop: 32,
    fontSize: 14,
    lineHeight: 21,
  },
  hint: { color: C.dim, textAlign: "center", fontSize: 13, marginTop: 20, marginBottom: 10 },
  identify: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: C.card,
    borderRadius: R.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    padding: 16,
    minHeight: 64,
    overflow: "hidden",
  },
  identifyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(157,120,255,0.14)",
  },
  identifyTitle: { color: C.text, fontSize: 15, fontWeight: "700" },
  identifyBody: { color: C.body, fontSize: 13, lineHeight: 19, marginTop: 4 },
});
