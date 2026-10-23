/**
 * Post a repo — the app's version of /post.
 *
 * The rule that shapes this screen is server-side and non-negotiable: you may
 * only list a repo you own, or one belonging to an org you're a member of.
 * The form therefore cannot pre-validate much; it takes a URL, and the server
 * says yes or no after checking GitHub. Saying so up front is kinder than
 * letting someone fill in categories for a repo that will be refused.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  ApiError,
  getCategories,
  postRepo,
  type Category,
} from "@/api";
import { useAuth } from "@/auth";
import { useAppState } from "@/app-state";
import {
  Blurb,
  Button,
  ErrorText,
  Field,
  Heading,
  Notice,
  Screen,
} from "@/components/ui";
import { C } from "@/theme";

const MAX_PER_GROUP = 3;

export default function PostScreen() {
  const { me } = useAuth();
  const { promptSignIn } = useAppState();
  const router = useRouter();

  const [url, setUrl] = useState("");
  const [useCases, setUseCases] = useState<Category[]>([]);
  const [sectors, setSectors] = useState<Category[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [newUseCases, setNewUseCases] = useState("");
  const [newSectors, setNewSectors] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      const res = await getCategories();
      setUseCases(res.useCases);
      setSectors(res.sectors);
    } catch {
      // Categories are optional on the server too — a repo posts fine without
      // them, so a failure here must not block the form.
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadCategories(); }, [loadCategories]);

  if (!me) {
    return (
      <Screen>
        <Heading>Post a repo</Heading>
        <Blurb>
          Listing a repo needs a GitHub account, because repoherald verifies
          that you own it before it goes in the feed.
        </Blurb>
        <Button label="Sign in" onPress={promptSignIn} />
      </Screen>
    );
  }

  const toggle = (id: string, group: Category[]) => {
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      const inGroup = prev.filter((p) => group.some((c) => c.id === p));
      if (inGroup.length >= MAX_PER_GROUP) return prev;
      return [...prev, id];
    });
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const { repoId } = await postRepo({
        url: url.trim(),
        categoryIds: picked,
        newUseCases,
        newSectors,
      });
      setUrl("");
      setPicked([]);
      setNewUseCases("");
      setNewSectors("");
      router.push(`/repo/${repoId}`);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Couldn't post that. Try again."
      );
    } finally {
      setBusy(false);
    }
  };

  const group = (title: string, items: Category[]) =>
    items.length === 0 ? null : (
      <>
        <Heading>{title}</Heading>
        <View style={styles.chips}>
          {items.map((c) => {
            const on = picked.includes(c.id);
            return (
              <Pressable
                key={c.id}
                onPress={() => toggle(c.id, items)}
                style={[styles.chip, on && styles.chipOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={c.label}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </>
    );

  return (
    <Screen>
      <Blurb>
        Post a GitHub repo you own, or one belonging to an organisation you
        belong to. repoherald checks with GitHub before it lists anything.
      </Blurb>

      <Field
        label="GitHub repo URL"
        value={url}
        onChangeText={setUrl}
        placeholder="github.com/owner/name"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        hint="Public repos only."
      />

      {group("Use case", useCases)}
      {group("Sector", sectors)}

      <Field
        label="New use cases"
        value={newUseCases}
        onChangeText={setNewUseCases}
        placeholder="comma, separated"
        autoCapitalize="none"
        hint={`Up to ${MAX_PER_GROUP} per group, counting the ones you ticked.`}
      />
      <Field
        label="New sectors"
        value={newSectors}
        onChangeText={setNewSectors}
        placeholder="comma, separated"
        autoCapitalize="none"
      />

      <Button
        label="Post repo"
        busy={busy}
        disabled={url.trim().length === 0}
        onPress={submit}
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Notice>Five listings a day, so the feed stays worth reading.</Notice>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: C.dim, fontSize: 13, fontWeight: "600" },
  chipTextOn: { color: "#120b24" },
});
