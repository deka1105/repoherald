/**
 * Identify — the app's version of /identify.
 *
 * This is the step repoherald used to do by hand: someone read a caption and
 * searched GitHub until they found the thing. It runs NVIDIA Nemotron on
 * Nebius Token Factory, and the one invariant worth repeating on every surface
 * that exposes it is that **the model only proposes names — GitHub decides.**
 * Every candidate is checked against the real API and one that does not
 * resolve is discarded however confident the model sounded, so this screen can
 * say it does not know but cannot invent a repository.
 *
 * It calls the public `/api/identify`, not a route under `/api/mobile/v1`, and
 * needs no account — see the note on `identify()` in src/api.ts for why a
 * second endpoint would mean a second set of rate-limit counters.
 *
 * Three result states have to stay told apart, because collapsing them would
 * make the screen lie about what just ran:
 *   - a repository, found and confirmed;
 *   - nothing found, with the model available — every candidate was checked
 *     and none survived;
 *   - nothing found, `degraded` — the rungs that repair a mangled or spoken
 *     name never ran, which is not the same answer at all.
 * A `needsReview` match is a fourth: real, confirmed to exist, and arrived at
 * by web search, which measured wrong about a third of the time.
 */
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import {
  ApiError,
  identify,
  type IdentifyAttempt,
  type IdentifyResult,
} from "@/api";
import {
  Blurb,
  Button,
  ErrorText,
  Field,
  Heading,
  Notice,
  Pill,
  Screen,
} from "@/components/ui";
import { C } from "@/theme";

type Fields = { caption: string; stillsText: string; transcript: string };

const EMPTY: Fields = { caption: "", stillsText: "", transcript: "" };

/**
 * One preset per way this is hard, because the interesting cases are the ones
 * nobody would think to type — and on a phone, nobody is going to type a
 * seventy-word transcript by hand to find out. The names are real repositories
 * from the catalogue; the damage is the damage the pipeline actually sees.
 */
const PRESETS: { label: string; hint: string; fields: Fields }[] = [
  {
    label: "A plain link",
    hint: "costs zero model calls — a regex reads a URL correctly",
    fields: {
      ...EMPTY,
      caption:
        "This one is actually free 👇\n\nhttps://github.com/HKUDS/ViMax\n\n#opensource #devtools",
    },
  },
  {
    label: "Spoken aloud",
    hint: "Whisper: the slash is said, the capitals and spacing are gone",
    fields: {
      ...EMPTY,
      transcript:
        "okay so number one on my list is ertasselli slash openterminal and honestly it should have way more stars than it does, link is in my bio",
    },
  },
  {
    label: "Read off the screen",
    hint: "OCR mangles glyphs — 5 for S, 1 for l, 0 for O",
    fields: {
      ...EMPTY,
      stillsText: "FREE ALTERNATIVE\nHKUD5/ViMax\ngithub\nSAVE THIS",
    },
  },
  {
    label: "Named nowhere",
    hint: "the reel describes it and never says what it is called",
    fields: {
      ...EMPTY,
      caption:
        "the open source tool that turns a long video into short clips automatically. self hosted, no watermark, no subscription",
    },
  },
];

const VIA_LABEL: Record<IdentifyAttempt["via"], string> = {
  url: "literal link",
  "model-fast": "Nemotron, fast tier",
  "model-deep": "Nemotron, deep tier",
  "web-search": "web search",
};

/** The five rungs, cheapest first. Collapsed by default — it is the answer to
 *  "how did it do that", which is a question asked after the first result. */
const RUNGS: { title: string; body: string }[] = [
  {
    title: "A literal link",
    body: "A regex. No model, no cost, and the only path that earns full confidence.",
  },
  {
    title: "Nemotron 3 Super (120B), fast tier",
    body: "Reads the caption, the on-screen text and the transcript together. Most posts stop here.",
  },
  {
    title: "Nemotron 3 Ultra (550B), deep tier",
    body: "Runs only on candidates GitHub has already rejected, and is told which ones, so it repairs rather than repeating itself. This is the rung that undoes spoken punctuation.",
  },
  {
    title: "Web search",
    body: "Only when the post named nothing at all. Two searches, then Nemotron ranks the results — taking the first link would be picking by result order.",
  },
  {
    title: "Nemotron verifies",
    body: "The one rung that can say no: it compares the post against the repository's real GitHub description and vetoes a near-miss. Search alone was wrong a third of the time and never once abstained.",
  },
];

/**
 * Zero model calls means two opposite things and must not be worded the same.
 * Rung one resolving a literal link is the ladder working as designed and
 * genuinely costing nothing; a degraded run that resolved nothing means a call
 * *was* needed and could not be made.
 */
function costLine(result: IdentifyResult): string {
  const took = ` · ${(result.ms / 1000).toFixed(1)}s`;
  if (result.modelCalls > 0) {
    const calls = `${result.modelCalls} Nemotron call${result.modelCalls === 1 ? "" : "s"}`;
    return `${calls}, ${result.tokens.toLocaleString()} tokens${took}`;
  }
  if (result.degraded && !result.repo) {
    return `No model call completed — the model was unavailable${took}`;
  }
  return `No model call needed — the link was literal.${took}`;
}

/** What GitHub said about one candidate, in the three states it can be in. */
function attemptNote(attempt: IdentifyAttempt): string {
  if (attempt.resolved) return "";
  if (attempt.ungrounded) return " — real, but this name is nowhere in the post";
  // Exists, and is somebody else's project. Saying "does not exist" about a
  // repository that does would be the one claim this screen cannot make.
  if (attempt.unverified) return " — exists, but not the project described";
  return " — does not exist";
}

export default function IdentifyScreen() {
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [active, setActive] = useState<string | null>(null);
  const [result, setResult] = useState<IdentifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showRungs, setShowRungs] = useState(false);

  const empty = !fields.caption && !fields.stillsText && !fields.transcript;
  const activeHint = PRESETS.find((p) => p.label === active)?.hint ?? null;
  // Narrowing inside the JSX does not survive into a deferred callback, so the
  // repository is pulled out once here and the callbacks close over that.
  const found = result?.repo ?? null;

  /** Typing means the boxes are no longer the preset they came from. */
  const set = (key: keyof Fields) => (value: string) => {
    setActive(null);
    setFields((f) => ({ ...f, [key]: value }));
  };

  async function run() {
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      setResult(await identify(fields));
    } catch (e) {
      // The server words its own refusals — the rate-limit messages especially
      // — so relay them rather than inventing a second copy here.
      setError(
        e instanceof ApiError ? e.message : "Couldn't reach repoherald."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Blurb>
        Paste what a post said and this works out which GitHub repository it is
        about — the step that used to be a person reading a caption and
        searching by hand.
      </Blurb>
      <Notice>
        The model only proposes names. GitHub decides: every candidate is
        checked against the real API, and one that doesn&rsquo;t resolve is
        discarded however confident the model sounded. So this can tell you it
        doesn&rsquo;t know — it can&rsquo;t invent a repository.
      </Notice>

      <Heading>Try one of these</Heading>
      <Text style={styles.presetIntro}>
        Four cases the real pipeline has to survive, or paste your own below.
      </Text>
      <View style={styles.presets}>
        {PRESETS.map((preset) => {
          const isActive = active === preset.label;
          return (
            <Pressable
              key={preset.label}
              onPress={() => {
                setFields(preset.fields);
                setActive(preset.label);
                setResult(null);
                setError(null);
              }}
              hitSlop={6}
              style={[styles.preset, isActive && styles.presetActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityHint={preset.hint}>
              <Text style={[styles.presetText, isActive && styles.presetTextActive]}>
                {preset.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {activeHint ? <Text style={styles.hint}>Loaded: {activeHint}</Text> : null}

      <Field
        label="Caption"
        value={fields.caption}
        onChangeText={set("caption")}
        placeholder="What the post said in writing"
        hint="Highest fidelity — often a literal link."
        multiline
        textAlignVertical="top"
        style={styles.box}
        autoCapitalize="none"
      />
      <Field
        label="On-screen text"
        value={fields.stillsText}
        onChangeText={set("stillsText")}
        placeholder="Text read off the frames"
        hint="Near-verbatim, with mangled characters."
        multiline
        textAlignVertical="top"
        style={styles.box}
        autoCapitalize="none"
      />
      <Field
        label="Narration"
        value={fields.transcript}
        onChangeText={set("transcript")}
        placeholder="What was said out loud"
        hint="Lossiest — punctuation is spoken, hyphens are not."
        multiline
        textAlignVertical="top"
        style={styles.box}
        autoCapitalize="none"
      />

      <Button
        label={busy ? "Identifying…" : "Identify the repository"}
        busy={busy}
        disabled={empty}
        onPress={run}
      />
      {!busy && !empty ? (
        <Pressable
          onPress={() => {
            setFields(EMPTY);
            setActive(null);
            setResult(null);
            setError(null);
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Clear all three boxes">
          <Text style={styles.clear}>Clear</Text>
        </Pressable>
      ) : null}

      {error ? <ErrorText>{error}</ErrorText> : null}

      {result ? (
        <>
          <Heading>{found ? "Identified" : "No repository found"}</Heading>

          {found ? (
            <View style={styles.card}>
              <Pressable
                style={styles.repoHead}
                onPress={() => {
                  WebBrowser.openBrowserAsync(
                    `https://github.com/${found.fullName}`
                  ).catch(() => setError("Couldn't open GitHub."));
                }}
                accessibilityRole="link"
                accessibilityLabel={`Open ${found.fullName} on GitHub`}>
                {found.avatarUrl ? (
                  <Image
                    source={{ uri: found.avatarUrl }}
                    style={styles.avatar}
                    contentFit="cover"
                  />
                ) : null}
                <Text style={styles.repoName} numberOfLines={2}>
                  {found.fullName}
                </Text>
              </Pressable>

              {found.description ? (
                <Text style={styles.desc}>{found.description}</Text>
              ) : null}

              <View style={styles.pills}>
                {found.language ? <Pill>{found.language}</Pill> : null}
                <Pill>★ {found.stars.toLocaleString()}</Pill>
                {result.foundIn ? <Pill>found in {result.foundIn}</Pill> : null}
                <Pill>confidence {Math.round(result.confidence * 100)}%</Pill>
                {found.archived ? <Pill>archived</Pill> : null}
                {result.needsReview ? <Pill>needs review</Pill> : null}
              </View>

              {result.needsReview ? (
                <Text style={styles.body}>
                  The post never named this, so the match rests on a search
                  result fitting a description. We measured that route: right
                  about two thirds of the time, wrong a third — search ranks by
                  authority, so an obscure project loses to the better-known one
                  it resembles. Too unreliable to catalogue on its own, so it
                  goes to the review queue as a pre-filled suggestion.
                </Text>
              ) : null}
            </View>
          ) : result.degraded ? (
            <Text style={styles.body}>
              No literal github.com link in that text, and the rungs that
              reconstruct a mangled or spoken name did not run — the model was
              unavailable. This is the honest &ldquo;before&rdquo; state: what
              the pipeline could manage when a person had to do the rest. A
              literal link still resolves.
            </Text>
          ) : (
            <Text style={styles.body}>
              Nothing it proposed survived checking, so it returned nothing
              rather than a guess. A candidate is dropped either because GitHub
              says it does not exist, or because the name appears nowhere in the
              post — a real repository the model free-associated to from the
              subject matter, which existence checking cannot catch. In the real
              pipeline this post goes to the review queue.
            </Text>
          )}

          {result.reasoning ? (
            <Text style={styles.reasoning}>{result.reasoning}</Text>
          ) : null}

          {result.attempts.length > 0 ? (
            <>
              <Heading>Every candidate, and what GitHub said</Heading>
              {result.attempts.map((attempt, i) => (
                <View key={`${attempt.fullName}-${i}`} style={styles.attempt}>
                  <Text
                    style={[
                      styles.mark,
                      attempt.resolved ? styles.markOk : styles.markNo,
                    ]}>
                    {attempt.resolved ? "✓" : "✗"}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.attemptName}>{attempt.fullName}</Text>
                    <Text style={styles.attemptVia}>
                      {VIA_LABEL[attempt.via] ?? attempt.via}
                      {attemptNote(attempt)}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          ) : null}

          <Text style={styles.cost}>{costLine(result)}</Text>
        </>
      ) : null}

      <Pressable
        onPress={() => setShowRungs((v) => !v)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityState={{ expanded: showRungs }}
        accessibilityLabel="How this works: the five rungs">
        <Heading>{showRungs ? "How this works ▾" : "How this works ▸"}</Heading>
      </Pressable>
      {showRungs ? (
        <>
          {RUNGS.map((rung, i) => (
            <View key={rung.title} style={styles.rung}>
              <Text style={styles.rungTitle}>
                {i + 1}. {rung.title}
              </Text>
              <Text style={styles.rungBody}>{rung.body}</Text>
            </View>
          ))}
          <Notice>
            A post with a link answers instantly. A spoken name takes about two
            seconds. A post that names nothing can take twenty — it is four
            model calls and two searches, and we would rather it be slow than
            wrong.
          </Notice>
        </>
      ) : null}

      <Notice>
        Text you submit here is sent to Nebius for inference and is not stored
        by repoherald. It is rate-limited so a finite credit balance survives
        being public.
      </Notice>
    </Screen>
  );
}

const styles = StyleSheet.create({
  presetIntro: { color: C.dim, fontSize: 13, lineHeight: 19, marginBottom: 10 },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  preset: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    backgroundColor: C.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  presetActive: { borderColor: C.accent, backgroundColor: C.accent },
  presetText: { color: C.body, fontSize: 13 },
  presetTextActive: { color: "#120b24", fontWeight: "700" },
  hint: { color: C.dim, fontSize: 12, lineHeight: 17, marginTop: 8 },
  // Tall enough for a few lines of a caption without turning the screen into
  // one long box per field.
  box: { minHeight: 96, paddingTop: 12 },
  clear: {
    color: C.dim,
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 12,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
  },
  repoHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 38, height: 38, borderRadius: 10 },
  repoName: {
    color: C.accent,
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
    textDecorationLine: "underline",
  },
  desc: { color: C.body, fontSize: 14, lineHeight: 20, marginTop: 12 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  body: { color: C.body, fontSize: 14, lineHeight: 21, marginTop: 12 },
  reasoning: { color: C.text, fontSize: 14, lineHeight: 21, marginTop: 14 },
  attempt: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 8,
  },
  mark: { fontSize: 14, fontWeight: "700", width: 16 },
  markOk: { color: "#4ade80" },
  markNo: { color: C.dim },
  attemptName: { color: C.text, fontSize: 14, fontWeight: "600" },
  attemptVia: { color: C.dim, fontSize: 12, lineHeight: 17, marginTop: 2 },
  cost: { color: C.dim, fontSize: 12, marginTop: 14 },
  rung: { marginBottom: 14 },
  rungTitle: { color: C.text, fontSize: 14, fontWeight: "700" },
  rungBody: { color: C.body, fontSize: 13, lineHeight: 19, marginTop: 4 },
});
