/**
 * One list — the app's version of /lists/[slug].
 *
 * Adding takes a URL or "owner/name" and resolves it against repos already on
 * repoherald. It cannot accept an arbitrary GitHub URL: that would create a
 * listing which bypassed the owner check in `postRepoFor`, so the server
 * refuses and this screen relays why.
 *
 * Searching and sorting are the web page's controls, done the way a phone does
 * them: the query is debounced rather than submitted with a button, because
 * there is no URL here to bookmark and a keyboard that has to be dismissed to
 * press Apply is a worse trade than one extra request. Both are server-side —
 * a 200-item list is well past what is worth filtering on the device, and the
 * note is searched alongside the repo's own fields, which is the part that
 * matters: a line on why a repo is there is the likeliest thing to remember.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  addToList,
  ApiError,
  deleteList,
  getList,
  removeListItem,
  type ListDetail,
} from "@/api";
import { useAppState } from "@/app-state";
import { RepoCard } from "@/components/repo-card";
import {
  Blurb,
  Button,
  ErrorText,
  Field,
  Heading,
  Loading,
  Notice,
  Screen,
} from "@/components/ui";
import { C } from "@/theme";

/** Same as the Search tab: a request a keystroke is a request a keystroke. */
const DEBOUNCE_MS = 300;

export default function ListScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { moderate } = useAppState();
  const router = useRouter();

  const [data, setData] = useState<ListDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [repoInput, setRepoInput] = useState("");
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("added");

  // Identifies the most recent request, so an earlier filter that resolves
  // late cannot overwrite a later one's results.
  const latest = useRef(0);

  const load = useCallback(
    async (q: string, s: string) => {
      if (!slug) return;
      const ticket = ++latest.current;
      try {
        const next = await getList(slug, { q, sort: s });
        if (ticket !== latest.current) return;
        setData(next);
        setError(null);
      } catch (e) {
        if (ticket !== latest.current) return;
        setError(e instanceof ApiError ? e.message : "Couldn't load this list.");
      } finally {
        if (ticket === latest.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [slug]
  );

  // The focus reload must not re-run on every keystroke, so it reads the
  // current filters through a ref rather than closing over them.
  const filters = useRef({ query, sort });
  useEffect(() => {
    filters.current = { query, sort };
  }, [query, sort]);

  useFocusEffect(
    useCallback(() => {
      load(filters.current.query, filters.current.sort);
    }, [load])
  );

  // Refetch when a filter changes. Skips its own first run, which the focus
  // effect above has already covered — without the guard every list opened
  // would cost two identical requests.
  const filtersReady = useRef(false);
  useEffect(() => {
    if (!filtersReady.current) {
      filtersReady.current = true;
      return;
    }
    const t = setTimeout(() => load(query, sort), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, sort, load]);

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: "List" }} />
        <Loading />
      </>
    );
  }

  if (!data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "List" }} />
        <ErrorText>{error ?? "This list isn't available."}</ErrorText>
      </Screen>
    );
  }

  const { list, items, limits } = data;

  // The app ships independently of the server, so a binary can be newer than
  // the deployment it is talking to. `limits.sorts` is the capability flag: a
  // server without it also ignores `q` and `sort`, so the controls are not
  // offered at all rather than offered dead — and nothing calls `.map` on an
  // undefined.
  const sorts = limits.sorts ?? [];
  const canFilter = sorts.length > 0;
  // Under the floor the query is ignored rather than refused, matching the
  // server: a stray single character shows the list, not an error.
  const searching = canFilter && query.trim().length >= (limits.searchMin ?? 2);

  const confirmDelete = () =>
    Alert.alert(
      `Delete “${list.title}”?`,
      "The list and its contents go away. The repos themselves are untouched. This cannot be undone.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteList(list.slug);
              router.back();
            } catch {
              setError("Couldn't delete that list.");
            }
          },
        },
      ]
    );

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={C.dim}
          onRefresh={() => {
            setRefreshing(true);
            load(query, sort);
          }}
        />
      }>
      <Stack.Screen options={{ title: list.title }} />

      {list.description ? <Blurb>{list.description}</Blurb> : null}
      <View style={styles.meta}>
        {/* Hidden while filtered: this counts what is on the list, and
            rendering a match count in its place would read as repos having
            gone missing. The match line below says how many matched. */}
        {searching ? null : (
          <Text style={styles.metaText}>
            {items.length} of {limits.maxItems}
          </Text>
        )}
        {list.ownerLogin ? (
          <Text style={styles.metaText}>by @{list.ownerLogin}</Text>
        ) : null}
        <Text style={styles.metaText}>
          {list.views.toLocaleString()} views
        </Text>
      </View>

      {/* Shown once there is something to look through, and kept while a
          search is active so a no-match query can be cleared. */}
      {canFilter && (items.length > 0 || searching) ? (
        <View style={styles.controls}>
          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder="Search this list — name, language, or your note"
            placeholderTextColor={C.dim}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            keyboardAppearance="dark"
            clearButtonMode="while-editing"
            accessibilityLabel="Search this list"
          />
          <View style={styles.sorts}>
            {sorts.map((option) => {
              const active = sort === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setSort(option.key)}
                  // The pill is ~34pt tall, so hitSlop carries it to the 44pt
                  // touch floor without a taller box crowding the row.
                  hitSlop={6}
                  style={[styles.sortPill, active && styles.sortPillActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Sort by ${option.label}`}>
                  <Text style={[styles.sortText, active && styles.sortTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {searching ? (
        <Text style={styles.matches}>
          {items.length} {items.length === 1 ? "match" : "matches"} for “
          {data.query || query.trim()}”
        </Text>
      ) : null}

      {items.length === 0 ? (
        <Notice>
          {searching
            ? "Nothing on this list matches that."
            : "Nothing in this list yet."}
        </Notice>
      ) : (
        items.map((item) => (
          <RepoCard
            key={item.itemId}
            repo={item.repo}
            note={item.note}
            source={item.source}
            onMore={moderate}
            footer={
              item.canRemove ? (
                <Text
                  style={styles.remove}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.repo.fullName} from this list`}
                  onPress={() =>
                    removeListItem(list.slug, item.itemId)
                      .then(() => load(query, sort))
                      .catch(() => setError("Couldn't remove that."))
                  }>
                  Remove
                </Text>
              ) : null
            }
          />
        ))
      )}

      {list.canAdd ? (
        <>
          <Heading>Add a repo</Heading>
          <Field
            label="Repo"
            value={repoInput}
            onChangeText={setRepoInput}
            placeholder="github.com/owner/name"
            autoCapitalize="none"
            autoCorrect={false}
            hint="It has to be listed on repoherald already."
          />
          <Field
            label="Note"
            value={note}
            onChangeText={setNote}
            placeholder="Why it's here (optional)"
            maxLength={limits.noteMax}
          />
          <Button
            label="Add to list"
            busy={adding}
            disabled={repoInput.trim().length === 0}
            onPress={async () => {
              setAdding(true);
              setError(null);
              setNotice(null);
              try {
                await addToList(list.slug, {
                  repo: repoInput.trim(),
                  note: note.trim(),
                });
                setRepoInput("");
                setNote("");
                setNotice("Added.");
                await load(query, sort);
              } catch (e) {
                setError(
                  e instanceof ApiError ? e.message : "Couldn't add that repo."
                );
              } finally {
                setAdding(false);
              }
            }}
          />
        </>
      ) : (
        <Notice>The owner has closed this list to new additions.</Notice>
      )}

      {notice ? <Text style={styles.ok}>{notice}</Text> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}

      {list.isOwner ? (
        <>
          <Heading>Danger zone</Heading>
          <Button label="Delete this list" variant="destructive" onPress={confirmDelete} />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginVertical: 14 },
  metaText: { color: C.dim, fontSize: 13 },
  controls: { marginBottom: 14, gap: 10 },
  search: {
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
  sorts: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sortPill: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: C.card,
  },
  sortPillActive: { borderColor: C.accent, backgroundColor: C.accent },
  sortText: { color: C.body, fontSize: 13 },
  sortTextActive: { color: "#120b24", fontWeight: "700" },
  matches: { color: C.dim, fontSize: 13, marginBottom: 12 },
  remove: { color: C.danger, fontSize: 13 },
  ok: { color: C.accent, fontSize: 14, marginTop: 12 },
});
