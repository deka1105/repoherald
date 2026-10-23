/**
 * Search — "where did I put that?"
 *
 * Two sources, and the line between them is the point of the screen: your own
 * lists first, then the public feed. A repo you filed from a DM is written
 * `hidden`, so it never appears in the public half; it surfaces here for you
 * and for nobody else. The server enforces that split (`src/lib/search.ts`);
 * this screen only has to label which half a result came from.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { ApiError, AuthError, search, type SearchResult } from "@/api";
import { useAuth } from "@/auth";
import { useAppState } from "@/app-state";
import { RepoCard } from "@/components/repo-card";
import { Loading } from "@/components/ui";
import { C, CONTENT_MAX_WIDTH } from "@/theme";

/** Matches the server's floor, so "go" and "ai" work but an empty box doesn't
 *  ask for the whole table. */
const MIN_QUERY = 2;
const DEBOUNCE_MS = 300;

export default function SearchScreen() {
  const { me } = useAuth();
  const { hidden, moderate } = useAppState();

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

  return (
    <View style={styles.root}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search repos, languages, owners"
          placeholderTextColor={C.dim}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          keyboardAppearance="dark"
          clearButtonMode="while-editing"
          accessibilityLabel="Search repos"
          onSubmitEditing={() => run(query)}
        />
      </View>

      {searching && results.length === 0 ? (
        <Loading />
      ) : (
        <FlatList
          data={[...mine, ...open]}
          keyExtractor={(r) => `${r.where}-${r.id}`}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
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
            <Text style={styles.empty}>
              {error ??
                (query.trim().length < MIN_QUERY
                  ? me
                    ? "Search the feed and everything in your own lists."
                    : "Search the feed. Sign in to also search your own lists."
                  : searched
                    ? `Nothing matches “${query.trim()}”.`
                    : "")}
            </Text>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
  },
  input: {
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.text,
    fontSize: 16,
    minHeight: 46,
  },
  list: {
    padding: 16,
    paddingBottom: Platform.OS === "android" ? 112 : 96,
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
  empty: { color: C.dim, textAlign: "center", marginTop: 48, fontSize: 14, lineHeight: 21 },
});
