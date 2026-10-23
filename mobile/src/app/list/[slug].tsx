/**
 * One list — the app's version of /lists/[slug].
 *
 * Adding takes a URL or "owner/name" and resolves it against repos already on
 * repoherald. It cannot accept an arbitrary GitHub URL: that would create a
 * listing which bypassed the owner check in `postRepoFor`, so the server
 * refuses and this screen relays why.
 */
import React, { useCallback, useState } from "react";
import { Alert, RefreshControl, StyleSheet, Text, View } from "react-native";
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

  const load = useCallback(async () => {
    if (!slug) return;
    try {
      setData(await getList(slug));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load this list.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [slug]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

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
            load();
          }}
        />
      }>
      <Stack.Screen options={{ title: list.title }} />

      {list.description ? <Blurb>{list.description}</Blurb> : null}
      <View style={styles.meta}>
        <Text style={styles.metaText}>
          {items.length} of {limits.maxItems}
        </Text>
        {list.ownerLogin ? (
          <Text style={styles.metaText}>by @{list.ownerLogin}</Text>
        ) : null}
        <Text style={styles.metaText}>
          {list.views.toLocaleString()} views
        </Text>
      </View>

      {items.length === 0 ? (
        <Notice>Nothing in this list yet.</Notice>
      ) : (
        items.map((item) => (
          <RepoCard
            key={item.itemId}
            repo={item.repo}
            note={item.note}
            onMore={moderate}
            footer={
              item.canRemove ? (
                <Text
                  style={styles.remove}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.repo.fullName} from this list`}
                  onPress={() =>
                    removeListItem(list.slug, item.itemId)
                      .then(load)
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
                await load();
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
  remove: { color: C.danger, fontSize: 13 },
  ok: { color: C.accent, fontSize: 14, marginTop: 12 },
});
