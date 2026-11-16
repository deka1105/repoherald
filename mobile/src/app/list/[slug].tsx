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
 *
 * On iOS the search field is the system's: on 26 it sits in a bottom toolbar
 * where the thumbs are, before 26 under the title. Android keeps a Material
 * field at the top of the content. Removing a repo is behind the card's
 * overflow menu rather than a red control on every row.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  addToList,
  ApiError,
  deleteList,
  getList,
  removeListItem,
  type ListDetail,
  type ListItem,
} from "@/api";
import { useAppState } from "@/app-state";
import { RepoCard, repoName } from "@/components/repo-card";
import {
  Blurb,
  Button,
  ErrorText,
  Field,
  Heading,
  Loading,
  Notice,
  Screen,
  Segments,
} from "@/components/ui";
import { C, LIQUID_GLASS } from "@/theme";

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
  // Shown once there is something to look through, and kept while a search is
  // active so a no-match query can be cleared.
  const showControls = canFilter && (items.length > 0 || searching);

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

  /** The card's overflow menu: remove (where allowed) ahead of report/block. */
  const openMenu = (item: ListItem) =>
    moderate(
      item.repo,
      item.canRemove
        ? [
            {
              label: "Remove from this list",
              hint: "Takes it off the list. The repo itself is untouched.",
              destructive: true,
              onPress: () =>
                removeListItem(list.slug, item.itemId)
                  .then(() => load(query, sort))
                  .catch(() => setError("Couldn't remove that.")),
            },
          ]
        : []
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

      {Platform.OS === "ios" && showControls ? (
        <>
          {/* iOS 26: a bottom toolbar whose only item is the search field, so
              it lands where the thumbs are. The slot is ignored before 26. */}
          {LIQUID_GLASS ? (
            <Stack.Toolbar placement="bottom">
              <Stack.Toolbar.SearchBarSlot />
            </Stack.Toolbar>
          ) : null}
          <Stack.SearchBar
            placeholder="Name, language, or your note"
            placement={LIQUID_GLASS ? "integrated" : "stacked"}
            onChangeText={(e) => setQuery(e.nativeEvent.text)}
            onCancelButtonPress={() => setQuery("")}
            autoCapitalize="none"
            hideWhenScrolling={false}
            textColor={C.text}
            hintTextColor={C.dim}
            tintColor={C.accent}
          />
        </>
      ) : null}

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

      {showControls ? (
        <View style={styles.controls}>
          {Platform.OS === "android" ? (
            <View>
              <Ionicons name="search" size={18} color={C.dim} style={styles.searchGlyph} />
              <TextInput
                style={styles.search}
                value={query}
                onChangeText={setQuery}
                placeholder="Name, language, or your note"
                placeholderTextColor={C.dim}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                keyboardAppearance="dark"
                accessibilityLabel="Search this list"
              />
            </View>
          ) : null}
          <Segments
            options={sorts.map((o) => ({ key: o.key, label: o.label }))}
            value={sort}
            onChange={setSort}
            label="Sort"
          />
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
            addedBy={item.addedByLogin}
            addedAt={item.addedAt}
            onMore={() => openMenu(item)}
            moreLabel={
              item.canRemove
                ? `Options for ${repoName(item.repo.fullName)}: remove, report or block`
                : `Options for ${repoName(item.repo.fullName)}: report or block`
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
  searchGlyph: { position: "absolute", left: 14, top: 15, zIndex: 1 },
  search: {
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
  matches: { color: C.dim, fontSize: 13, marginBottom: 12 },
  ok: { color: C.accent, fontSize: 14, marginTop: 12 },
});
