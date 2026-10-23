/**
 * Lists — your own curated pages, and where ingested repos land.
 *
 * A list whose `source` is instagram or tiktok was made for you when you
 * claimed that handle; it is where a repo you sent in a DM gets filed. That
 * is the product's headline, so those lists are labelled rather than left
 * looking like something you forgot making.
 */
import React, { useCallback, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ApiError,
  createList,
  getLists,
  type ListSummary,
} from "@/api";
import { useAuth } from "@/auth";
import { useAppState } from "@/app-state";
import {
  Blurb,
  Button,
  Card,
  ErrorText,
  Field,
  Heading,
  Loading,
  Notice,
  Screen,
} from "@/components/ui";
import { C } from "@/theme";

const SOURCE_LABELS: Record<ListSummary["source"], string | null> = {
  manual: null,
  instagram: "From Instagram",
  tiktok: "From TikTok",
};

export default function ListsScreen() {
  const { me } = useAuth();
  const { promptSignIn } = useAppState();
  const router = useRouter();

  const [lists, setLists] = useState<ListSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!me) {
      setLoading(false);
      return;
    }
    try {
      const res = await getLists();
      setLists(res.lists);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load your lists.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [me]);

  // Reloaded on focus, not just on mount: coming back from a list where you
  // added or removed a repo must not show a stale count.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!me) {
    return (
      <Screen>
        <Heading>Lists</Heading>
        <Blurb>
          Lists are private, link-shareable pages of repos. Claim your
          Instagram or TikTok handle on the web and everything you sent us in a
          DM gets filed into one automatically.
        </Blurb>
        <Button label="Sign in" onPress={promptSignIn} />
      </Screen>
    );
  }

  if (loading) return <Loading />;

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
      {lists.length === 0 ? (
        <Blurb>No lists yet. Make one below.</Blurb>
      ) : (
        lists.map((l) => (
          <Pressable
            key={l.id}
            onPress={() => router.push(`/list/${l.slug}`)}
            accessibilityRole="button"
            accessibilityLabel={`${l.title}, ${l.itemCount} repos`}>
            <Card>
              <View style={styles.row}>
                <Text style={styles.title} numberOfLines={1}>
                  {l.title}
                </Text>
                <Text style={styles.count}>{l.itemCount}</Text>
              </View>
              {l.description ? (
                <Text style={styles.desc} numberOfLines={2}>
                  {l.description}
                </Text>
              ) : null}
              <View style={styles.tags}>
                {SOURCE_LABELS[l.source] ? (
                  <Text style={styles.tagAccent}>{SOURCE_LABELS[l.source]}</Text>
                ) : null}
                <Text style={styles.tag}>
                  {l.visibility === "private" ? "Private" : "Anyone with the link"}
                </Text>
                <Text style={styles.tag}>
                  {l.contributions === "open" ? "Open to additions" : "Closed"}
                </Text>
              </View>
            </Card>
          </Pressable>
        ))
      )}

      <Heading>New list</Heading>
      <Field
        label="Name"
        value={title}
        onChangeText={setTitle}
        placeholder="Scrapers worth keeping"
        maxLength={80}
      />
      <Field
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="Optional"
        maxLength={300}
        multiline
      />
      <Button
        label="Create list"
        busy={creating}
        disabled={title.trim().length < 3}
        onPress={async () => {
          setCreating(true);
          setError(null);
          try {
            const { slug } = await createList(title.trim(), description.trim());
            setTitle("");
            setDescription("");
            await load();
            router.push(`/list/${slug}`);
          } catch (e) {
            setError(
              e instanceof ApiError ? e.message : "Couldn't create that list."
            );
          } finally {
            setCreating(false);
          }
        }}
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Notice>
        A list is reachable by anyone holding its link unless you make it
        private on the web. The link is not guessable.
      </Notice>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: { color: C.text, fontSize: 16, fontWeight: "700", flexShrink: 1 },
  count: { color: C.dim, fontSize: 14 },
  desc: { color: C.body, fontSize: 14, lineHeight: 20, marginTop: 8 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12 },
  tag: { color: C.dim, fontSize: 12 },
  tagAccent: { color: C.accent, fontSize: 12, fontWeight: "600" },
});
