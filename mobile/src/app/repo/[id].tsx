/**
 * One repo — the app's version of /repos/[id].
 *
 * Everything the web page offers except the two things that cannot ship:
 * donating credits to highlight a repo (spending is left out with buying, so
 * the wallet has one honest job) and reporting an upstream issue for credit,
 * which needs a GitHub issue URL nobody is typing on a phone.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams } from "expo-router";
import {
  addToList,
  ApiError,
  claimStar,
  deleteComment,
  getRepo,
  postComment,
  toggleLike,
  type RepoDetail,
} from "@/api";
import { useAuth } from "@/auth";
import { useAppState } from "@/app-state";
import {
  Blurb,
  Button,
  Card,
  Column,
  ErrorText,
  Heading,
  Loading,
  Notice,
  Pill,
  Screen,
  timeAgo,
} from "@/components/ui";
import { C } from "@/theme";

const COMMENT_MAX = 1000;

function fmtDuration(mins: number) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default function RepoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me, refresh: refreshMe } = useAuth();
  const { moderate, promptSignIn } = useAppState();

  const [data, setData] = useState<RepoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "like" | "claim" | "comment">(null);
  const [draft, setDraft] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setData(await getRepo(id));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load this repo.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  /** Every action funnels through here so one `catch` words every failure and
   *  no two buttons can be in flight at once. */
  const act = async (
    kind: "like" | "claim" | "comment",
    fn: () => Promise<string | null>
  ) => {
    setBusy(kind);
    setError(null);
    setNotice(null);
    try {
      const message = await fn();
      if (message) setNotice(message);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: "Repo" }} />
        <Loading />
      </>
    );
  }

  if (!data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Repo" }} />
        <ErrorText>{error ?? "This repo isn't available."}</ErrorText>
      </Screen>
    );
  }

  const { repo, viewer, limits } = data;
  const signedIn = Boolean(me);

  const addToFirstList = () => {
    const lists = viewer?.listsMissingRepo ?? [];
    if (lists.length === 0) {
      Alert.alert(
        "No lists yet",
        "Make a list on the Lists tab, then add this repo to it."
      );
      return;
    }
    Alert.alert(
      "Add to list",
      `Add ${repo.fullName} to…`,
      [
        ...lists.slice(0, 3).map((l) => ({
          text: l.title,
          onPress: () => {
            // The slug isn't in this payload, and the list endpoint is keyed
            // on it — so the add goes through the list's own id-free route by
            // reloading afterwards rather than guessing a slug here.
            addToList(l.id, { repoId: repo.id })
              .then(() => {
                setNotice(`Added to ${l.title}.`);
                load();
              })
              .catch((e: unknown) =>
                setError(
                  e instanceof ApiError ? e.message : "Couldn't add it to that list."
                )
              );
          },
        })),
        { text: "Cancel", style: "cancel" as const },
      ]
    );
  };

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
      <Stack.Screen options={{ title: repo.name }} />

      <View style={styles.head}>
        {repo.avatarUrl ? (
          <Image source={{ uri: repo.avatarUrl }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, { backgroundColor: C.line }]} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{repo.fullName}</Text>
          {repo.isArchived ? <Text style={styles.archived}>Archived</Text> : null}
        </View>
      </View>

      {repo.description ? <Blurb>{repo.description}</Blurb> : null}

      <View style={styles.metaRow}>
        <Text style={styles.meta}>★ {repo.starsCount.toLocaleString()}</Text>
        {repo.primaryLanguage ? (
          <Text style={styles.meta}>{repo.primaryLanguage}</Text>
        ) : null}
        {repo.postedByLogin ? (
          <Text style={styles.meta}>
            posted by @{repo.postedByLogin} · {timeAgo(repo.createdAt)}
          </Text>
        ) : null}
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.meta}>
          {repo.views.toLocaleString()} views · {repo.visitors.toLocaleString()} visitors
        </Text>
        <Text style={styles.meta}>
          {repo.donationCount} {repo.donationCount === 1 ? "donation" : "donations"}
        </Text>
        <Text style={styles.meta}>
          {fmtDuration(repo.highlightMinutes)} highlight time
        </Text>
      </View>

      {repo.categoryLabels.length > 0 ? (
        <View style={styles.pills}>
          {repo.categoryLabels.map((label) => (
            <Pill key={label}>{label}</Pill>
          ))}
        </View>
      ) : null}

      <Button
        label="View on GitHub"
        onPress={() => Linking.openURL(`https://github.com/${repo.fullName}`)}
      />

      <Button
        label={`${viewer?.liked ? "Liked" : "Like"} · ${data.likeCount}`}
        variant="secondary"
        busy={busy === "like"}
        onPress={() => {
          if (!signedIn) return promptSignIn();
          act("like", async () => {
            const res = await toggleLike(repo.id);
            setData((d) =>
              d
                ? {
                    ...d,
                    likeCount: res.likeCount,
                    viewer: d.viewer ? { ...d.viewer, liked: res.liked } : d.viewer,
                  }
                : d
            );
            return null;
          });
        }}
      />

      {signedIn && viewer && !viewer.isOwn ? (
        <Button
          label={viewer.alreadyClaimed ? "Star already claimed" : "I starred it — claim credit"}
          variant="secondary"
          disabled={viewer.alreadyClaimed}
          busy={busy === "claim"}
          onPress={() =>
            act("claim", async () => {
              const res = await claimStar(repo.id);
              await Promise.all([load(), refreshMe()]);
              return res.message ?? "Credit added to your wallet.";
            })
          }
        />
      ) : null}

      {signedIn ? (
        <Button label="Add to a list" variant="secondary" onPress={addToFirstList} />
      ) : null}

      <Button
        label="Report or block"
        variant="secondary"
        onPress={() => moderate(repo)}
      />

      {!signedIn ? (
        <Notice>Sign in to like, comment, and claim credit for starring this repo.</Notice>
      ) : null}

      {viewer ? (
        <Notice>
          Star claims used: {viewer.claimsToday}/{limits.dailyMintCap} today ·{" "}
          {viewer.claimsThisWeek}/{limits.weeklyMintCap} this week
        </Notice>
      ) : null}

      <Notice>
        Star this repo on GitHub, then claim your credit here — 1 verified star
        earns 1 credit (1 hour of self-highlight, or donate 15 minutes to any
        repo, both on the web). Unstarring within 100 days revokes the benefit.
      </Notice>

      {notice ? <Text style={styles.ok}>{notice}</Text> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}

      <Heading>
        {data.comments.length} {data.comments.length === 1 ? "comment" : "comments"}
      </Heading>

      {signedIn ? (
        <>
          <TextInput
            style={styles.commentInput}
            value={draft}
            onChangeText={setDraft}
            placeholder="Add a comment"
            placeholderTextColor={C.dim}
            keyboardAppearance="dark"
            multiline
            maxLength={COMMENT_MAX}
            accessibilityLabel="Add a comment"
          />
          <Button
            label="Post comment"
            busy={busy === "comment"}
            disabled={draft.trim().length < 2}
            onPress={() =>
              act("comment", async () => {
                await postComment(repo.id, draft.trim());
                setDraft("");
                await load();
                return null;
              })
            }
          />
        </>
      ) : (
        <Pressable onPress={promptSignIn} accessibilityRole="button">
          <Text style={styles.signInLink}>Sign in to comment</Text>
        </Pressable>
      )}

      {data.comments.map((c) => (
        <Card key={c.id}>
          <View style={styles.commentHead}>
            <Text style={styles.commentAuthor}>
              {c.authorLogin ? `@${c.authorLogin}` : c.authorName}
            </Text>
            <Text style={styles.commentWhen}>{timeAgo(c.createdAt)}</Text>
          </View>
          <Text style={styles.commentBody}>{c.body}</Text>
          {c.canDelete ? (
            <Pressable
              onPress={() =>
                Alert.alert("Delete comment?", "This cannot be undone.", [
                  { text: "Keep", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: () =>
                      deleteComment(c.id)
                        .then(load)
                        .catch(() => setError("Couldn't delete that comment.")),
                  },
                ])
              }
              accessibilityRole="button"
              accessibilityLabel="Delete this comment"
              hitSlop={8}>
              <Text style={styles.delete}>Delete</Text>
            </Pressable>
          ) : null}
        </Card>
      ))}

      {data.comments.length === 0 ? (
        <Column>
          <Text style={styles.noComments}>No comments yet.</Text>
        </Column>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 12 },
  avatar: { width: 52, height: 52, borderRadius: 13 },
  title: { color: C.text, fontSize: 20, fontWeight: "700" },
  archived: { color: C.dim, fontSize: 12, marginTop: 4, letterSpacing: 0.5 },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 12,
  },
  meta: { color: C.dim, fontSize: 13 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  ok: { color: C.accent, fontSize: 14, marginTop: 12, lineHeight: 20 },
  commentInput: {
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    borderRadius: 12,
    padding: 14,
    color: C.text,
    fontSize: 15,
    minHeight: 88,
    textAlignVertical: "top",
  },
  commentHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  commentAuthor: { color: C.text, fontSize: 14, fontWeight: "700" },
  commentWhen: { color: C.dim, fontSize: 12 },
  commentBody: { color: C.body, fontSize: 15, lineHeight: 21, marginTop: 8 },
  delete: { color: C.danger, fontSize: 13, marginTop: 12 },
  signInLink: { color: C.accent, fontSize: 15, paddingVertical: 12 },
  noComments: { color: C.dim, fontSize: 14, paddingVertical: 8 },
});
