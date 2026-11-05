/**
 * One repo, as it appears in the feed, in search results and inside a list.
 *
 * Tapping opens the repo screen rather than GitHub directly. That is the
 * website's behaviour, and it is also what makes the comments, the like and
 * the star claim reachable at all — on the web they live on /repos/[id], and
 * a card that jumped straight to github.com would leave them with no door.
 * "View on GitHub" is the first button on the screen it opens.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { C } from "@/theme";
import type { RepoSource, RepoSummary } from "@/api";

/** "owner/name" is all the API sends, so the card derives both halves from it.
 *  Falls back to the whole string rather than rendering an empty title if a
 *  listing ever arrives without a slash. */
export const repoOwner = (fullName: string) => fullName.split("/")[0] ?? fullName;
export const repoName = (fullName: string) => fullName.split("/")[1] ?? fullName;

const PLATFORM_LABEL: Record<RepoSource["platform"], string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X",
  reddit: "Reddit",
  facebook: "Facebook",
};

/**
 * Keyed loosely on purpose. The server's column has no CHECK constraint behind
 * it and production already holds values its own schema never listed, so an
 * unrecognised one gets no hint -- which is better than asserting something
 * untrue about where the repo was named.
 */
const FOUND_IN_LABEL: Record<string, string> = {
  caption: "the caption",
  "caption-cue": "the caption",
  screen: "on-screen text",
  narration: "the narration",
};

/** "Instagram reel", "TikTok post" -- the noun comes from the URL, so a reel
 *  is not announced as a post. */
function sourceLabel(source: RepoSource): string {
  const noun = /\/reels?\//.test(source.postUrl) ? "reel" : "post";
  return `${PLATFORM_LABEL[source.platform] ?? source.platform} ${noun}`;
}

/**
 * Link out to the post a listing was rescued from.
 *
 * Opened in the in-app browser rather than handed to Safari, like every other
 * outbound link here. Its own Pressable, nested inside the card's: the inner
 * one takes the touch, so tapping the source opens the post while tapping
 * anywhere else still opens the repo.
 */
function SourceLink({ source }: { source: RepoSource }) {
  const label = sourceLabel(source);
  const foundIn = source.foundIn ? FOUND_IN_LABEL[source.foundIn] : undefined;
  return (
    <Pressable
      onPress={() => {
        WebBrowser.openBrowserAsync(source.postUrl).catch(() => {});
      }}
      hitSlop={8}
      accessibilityRole="link"
      accessibilityLabel={
        foundIn
          ? `Source: ${label}. The repo was named in ${foundIn}.`
          : `Source: ${label}`
      }>
      <Text style={styles.source} numberOfLines={1}>
        {"\u2197"} Source: {label}
      </Text>
    </Pressable>
  );
}

export function RepoCard({
  repo,
  onMore,
  footer,
  note,
  source,
}: {
  repo: RepoSummary;
  /** Omitted where a long-press menu makes no sense (inside your own list). */
  onMore?: (repo: RepoSummary) => void;
  footer?: React.ReactNode;
  note?: string | null;
  /** The post this listing was rescued from. Absent for an owner-posted repo,
   *  and absent for anyone but the list's owner and staff. */
  source?: RepoSource | null;
}) {
  const router = useRouter();
  const open = () => router.push(`/repo/${repo.id}`);

  return (
    <Pressable
      style={styles.card}
      onPress={open}
      // Long-press is the gesture people reach for, but it is invisible and
      // VoiceOver users would never find it — hence the "More" control too.
      onLongPress={onMore ? () => onMore(repo) : undefined}
      accessibilityRole="button"
      accessibilityLabel={`${repo.fullName}, ${repo.starsCount} stars`}>
      <View style={styles.head}>
        {repo.avatarUrl ? (
          <Image source={{ uri: repo.avatarUrl }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, { backgroundColor: C.line }]} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {repoName(repo.fullName)}
          </Text>
          <Text style={styles.owner} numberOfLines={1}>
            {repoOwner(repo.fullName)}
          </Text>
        </View>
        <Text style={styles.stars}>★ {repo.starsCount.toLocaleString()}</Text>
        {onMore ? (
          <Pressable
            onPress={() => onMore(repo)}
            style={styles.more}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={`Report or block ${repoOwner(repo.fullName)}`}>
            <Text style={styles.moreGlyph}>•••</Text>
          </Pressable>
        ) : null}
      </View>

      {repo.description ? (
        <Text style={styles.desc} numberOfLines={3}>
          {repo.description}
        </Text>
      ) : null}

      {note ? <Text style={styles.note}>“{note}”</Text> : null}

      <View style={styles.meta}>
        {repo.primaryLanguage ? (
          <Text style={styles.lang}>{repo.primaryLanguage}</Text>
        ) : null}
        {repo.isArchived ? <Text style={styles.archived}>Archived</Text> : null}
        {source ? <SourceLink source={source} /> : null}
        {footer}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 38, height: 38, borderRadius: 10 },
  name: { color: C.text, fontSize: 16, fontWeight: "700" },
  owner: { color: C.dim, fontSize: 13, marginTop: 1 },
  stars: { color: C.dim, fontSize: 13 },
  // The report/block affordance. Quiet by default — it is a safety control,
  // not a feature to advertise — but a real target, not just a long-press.
  more: { paddingLeft: 12, paddingVertical: 2 },
  moreGlyph: { color: C.dim, fontSize: 13, letterSpacing: 1, fontWeight: "700" },
  desc: { color: C.body, fontSize: 14, lineHeight: 20, marginTop: 12 },
  note: {
    color: C.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
    fontStyle: "italic",
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 10,
  },
  lang: { color: C.dim, fontSize: 12, letterSpacing: 0.5 },
  archived: { color: C.dim, fontSize: 12, letterSpacing: 0.5 },
  source: { color: C.accent, fontSize: 12 },
});
