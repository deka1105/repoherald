/**
 * One repo, as it appears in the feed, in search results and inside a list.
 *
 * Tapping opens the repo screen rather than GitHub directly. That is the
 * website's behaviour, and it is also what makes the comments, the like and
 * the star claim reachable at all — on the web they live on /repos/[id], and
 * a card that jumped straight to github.com would leave them with no door.
 * "View on GitHub" is the first button on the screen it opens.
 *
 * The whole card is the tap target, not just the title, and it is well past
 * the 44pt floor. Everything else on it is a nested Pressable that takes its
 * own touch: the source link, the "more" toggle and the overflow menu.
 */
import React, { useState } from "react";
import {
  LayoutAnimation,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { C, R } from "@/theme";
import type { RepoSource, RepoSummary } from "@/api";
import { Avatar, IconButton, timeAgo } from "@/components/ui";

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
      // 12pt text; the slop takes the target to the 44pt floor.
      hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
      accessibilityRole="link"
      accessibilityLabel={
        foundIn
          ? `Source: ${label}. The repo was named in ${foundIn}.`
          : `Source: ${label}`
      }>
      <Text style={styles.source} numberOfLines={1}>
        {"↗"} Source: {label}
      </Text>
    </Pressable>
  );
}

/** How many lines a description gets before it has to ask for a tap. */
const DESCRIPTION_LINES = 2;

/**
 * The description, capped at two lines with a "more" that expands it in place.
 *
 * Every card used to clamp at three lines and end in an ellipsis with no way
 * to read the rest, and because GitHub descriptions run anywhere from five
 * words to a paragraph, the cut landed somewhere different on every card and
 * the list looked uneven. Two lines is the same height everywhere; the toggle
 * only appears when there is actually more to read.
 *
 * Whether it overflows is measured on an invisible unclamped copy, because a
 * clamped `Text` reports only the lines it drew. The copy is absolutely
 * positioned so it adds no height, and hidden from assistive tech so the
 * description is not read twice.
 */
function Description({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext({
      duration: 220,
      update: { type: "spring", springDamping: 0.85 },
      create: { type: "easeInEaseOut", property: "opacity" },
    });
    setExpanded((v) => !v);
  };

  return (
    <View style={styles.descBox}>
      <Text style={styles.desc} numberOfLines={expanded ? undefined : DESCRIPTION_LINES}>
        {text}
      </Text>
      <Text
        style={[styles.desc, styles.descMeasure]}
        onTextLayout={(e) => setOverflows(e.nativeEvent.lines.length > DESCRIPTION_LINES)}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none">
        {text}
      </Text>
      {overflows ? (
        <Pressable
          onPress={toggle}
          // ~17pt of text + 14pt either side clears 44pt.
          hitSlop={{ top: 14, bottom: 14, left: 12, right: 12 }}
          style={styles.moreBtn}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={expanded ? "Show less of the description" : "Read the whole description"}>
          <Text style={styles.more}>{expanded ? "Less" : "More"}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function RepoCard({
  repo,
  onMore,
  moreLabel = `More options for ${repoName(repo.fullName)}`,
  footer,
  note,
  source,
  addedBy,
  addedAt,
}: {
  repo: RepoSummary;
  /** Opens the overflow menu — report and block, plus whatever the screen
   *  adds (remove from list). Omitted where no action applies. */
  onMore?: (repo: RepoSummary) => void;
  /** Spoken label for the overflow control; defaults to a generic one. */
  moreLabel?: string;
  footer?: React.ReactNode;
  note?: string | null;
  /** The post this listing was rescued from. Absent for an owner-posted repo,
   *  and absent for anyone but the list's owner and staff. */
  source?: RepoSource | null;
  /** Who put it on this list, and when — provenance a star count does not
   *  carry. Only list items have it. */
  addedBy?: string | null;
  addedAt?: string | null;
}) {
  const router = useRouter();
  const open = () => router.push(`/repo/${repo.id}`);
  const name = repoName(repo.fullName);
  const owner = repoOwner(repo.fullName);
  const added = addedAt ? timeAgo(addedAt) : "";

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      android_ripple={{ color: "rgba(255,255,255,0.06)", foreground: true }}
      onPress={open}
      // Long-press is the gesture people reach for, but it is invisible and
      // VoiceOver users would never find it — hence the overflow control and
      // the accessibility action too.
      onLongPress={onMore ? () => onMore(repo) : undefined}
      accessibilityRole="button"
      accessibilityLabel={`${repo.fullName}, ${repo.starsCount.toLocaleString()} stars`}
      accessibilityHint="Opens the repo"
      accessibilityActions={onMore ? [{ name: "more", label: moreLabel }] : undefined}
      onAccessibilityAction={onMore ? () => onMore(repo) : undefined}>
      <View style={styles.head}>
        <Avatar uri={repo.avatarUrl} name={name} size={38} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.owner} numberOfLines={1}>
            {owner}
          </Text>
        </View>
        <Text style={styles.stars}>★ {repo.starsCount.toLocaleString()}</Text>
        {onMore ? (
          // Quiet by default — it is a safety control, not a feature to
          // advertise, and at full contrast it competed with the star count.
          // `faint` clears the 3:1 floor for a non-text control; the full
          // 44pt target is kept and pulled into the card's padding so the
          // row stays compact.
          <IconButton
            name="ellipsis-horizontal"
            size={18}
            color={C.faint}
            label={moreLabel}
            onPress={() => onMore(repo)}
            style={styles.more44}
          />
        ) : null}
      </View>

      {repo.description ? <Description text={repo.description} /> : null}

      {note ? <Text style={styles.note}>“{note}”</Text> : null}

      <View style={styles.meta}>
        {repo.primaryLanguage ? (
          <Text style={styles.lang}>{repo.primaryLanguage}</Text>
        ) : null}
        {repo.isArchived ? <Text style={styles.archived}>Archived</Text> : null}
        {addedBy || added ? (
          <Text style={styles.added} numberOfLines={1}>
            {addedBy ? `added by @${addedBy}` : "added"}
            {added ? ` · ${added}` : ""}
          </Text>
        ) : null}
        {source ? <SourceLink source={source} /> : null}
        {footer}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: R.card,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    // Clips the Android ripple to the rounded corners.
    overflow: "hidden",
  },
  cardPressed: { opacity: 0.92 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { color: C.text, fontSize: 16, fontWeight: "700" },
  owner: { color: C.dim, fontSize: 13, marginTop: 1 },
  stars: { color: C.dim, fontSize: 13 },
  more44: { marginRight: -14, marginVertical: -12, marginLeft: -4 },
  descBox: { marginTop: 12 },
  desc: { color: C.body, fontSize: 14, lineHeight: 20 },
  descMeasure: { position: "absolute", left: 0, right: 0, top: 0, opacity: 0 },
  moreBtn: { alignSelf: "flex-start", marginTop: 4 },
  more: { color: C.accent, fontSize: 13, fontWeight: "600" },
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
  added: { color: C.dim, fontSize: 12 },
  source: { color: C.accent, fontSize: 12 },
});
