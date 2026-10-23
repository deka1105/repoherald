/**
 * Account — who you are, the block list, the policies, and deletion.
 *
 * The delete control is the reason this screen cannot be an afterthought.
 * App Store Guideline 5.1.1(v) requires an app that supports account creation
 * to also support account deletion from inside the app — pointing at the
 * website is an explicit rejection — and it has to be reachable, not buried.
 * It is one tab away from everything.
 *
 * There is deliberately no way to *buy* credits here. Selling a digital
 * currency outside In-App Purchase breaks Guideline 3.1.1, and even linking
 * out to a web purchase flow is a fight not worth having, so the app does not
 * mention one.
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import {
  Blurb,
  Button,
  ErrorText,
  Heading,
  LinkRow,
  Notice,
  Row,
  Screen,
} from "@/components/ui";
import { C } from "@/theme";
import {
  COOKIES_URL,
  PRIVACY_URL,
  REFUNDS_URL,
  TERMS_URL,
} from "@/config";
import { useAuth } from "@/auth";
import { useAppState } from "@/app-state";
import { unblockOwner } from "@/blocks";

const POLICIES = [
  { label: "Privacy Policy", url: PRIVACY_URL },
  { label: "Terms of Service", url: TERMS_URL },
  { label: "Cookie Policy", url: COOKIES_URL },
  { label: "Refund Policy", url: REFUNDS_URL },
];

export default function AccountScreen() {
  const { me, busy, signOut, deleteAccount } = useAuth();
  const { blocked, setBlocked, promptSignIn } = useAppState();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const confirmDelete = () => {
    setError(null);
    // Two-step, and the destructive option is never the default button.
    Alert.alert(
      "Delete your account?",
      "This permanently removes your profile and GitHub connection, and hides " +
        "the repos you posted. Credit history is kept anonymised for accounting. " +
        "This cannot be undone.",
      [
        { text: "Keep my account", style: "cancel" },
        {
          text: "Delete permanently",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount();
            } catch {
              setError("Couldn't delete your account. Please try again.");
            }
          },
        },
      ]
    );
  };

  return (
    <Screen>
      {me ? (
        <>
          <View style={styles.identity}>
            {me.avatarUrl ? (
              <Image source={{ uri: me.avatarUrl }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, { backgroundColor: C.line }]} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {me.name ?? me.githubLogin ?? "Signed in"}
              </Text>
              {me.githubLogin ? (
                <Text style={styles.handle} numberOfLines={1}>
                  {me.githubLogin}
                </Text>
              ) : null}
            </View>
          </View>

          <Row label="Credits" value={me.creditBalance} />
          <Row label="Can earn credits" value={me.mintEligible ? "Yes" : "Not yet"} />
        </>
      ) : (
        <>
          <Blurb>
            You are not signed in. Browsing, searching, reporting and blocking
            all work without an account — signing in adds posting, lists,
            comments and credits.
          </Blurb>
          <Button label="Sign in" onPress={promptSignIn} />
        </>
      )}

      {/* Blocking has to be undoable, or it is a trap rather than a control.
          This list is the only place a block can be lifted — which is why it
          is reachable signed out, since blocking is too. */}
      <Heading>Blocked accounts</Heading>
      {blocked.length === 0 ? (
        <Blurb>
          You haven&rsquo;t blocked anyone. Tap &bull;&bull;&bull; on any repo
          to report it or block the account that posted it.
        </Blurb>
      ) : (
        blocked.map((owner) => (
          <Row
            key={owner}
            label={owner}
            value={
              <Pressable
                onPress={async () => {
                  try {
                    setBlocked(await unblockOwner(owner));
                  } catch {
                    setError("Couldn't unblock that account.");
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={`Unblock ${owner}`}
                hitSlop={10}>
                <Text style={styles.unblock}>Unblock</Text>
              </Pressable>
            }
          />
        ))
      )}

      <Heading>Help</Heading>
      <LinkRow label="Contact support" onPress={() => router.push("/support")} />

      <Heading>Policies</Heading>
      {POLICIES.map((p) => (
        <LinkRow
          key={p.url}
          label={p.label}
          // openBrowserAsync, not Linking: this keeps the policy inside the
          // app rather than handing the person to Safari and losing them.
          onPress={() => {
            WebBrowser.openBrowserAsync(p.url).catch(() =>
              setError("Couldn't open that page.")
            );
          }}
        />
      ))}

      {me ? (
        <>
          <Button
            label="Sign out"
            variant="secondary"
            disabled={busy}
            onPress={signOut}
          />

          <Heading>Danger zone</Heading>
          <Button
            label="Delete my account"
            variant="destructive"
            disabled={busy}
            onPress={confirmDelete}
          />
          <Notice>
            Deletes your profile and GitHub connection and hides your posts.
            Credit history is kept anonymised for accounting integrity.
          </Notice>
        </>
      ) : null}

      {busy ? <ActivityIndicator color={C.accent} style={{ marginTop: 20 }} /> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 8 },
  avatar: { width: 56, height: 56, borderRadius: 14 },
  name: { color: C.text, fontSize: 18, fontWeight: "700" },
  handle: { color: C.dim, fontSize: 14, marginTop: 2 },
  unblock: { color: C.accent, fontSize: 15, fontWeight: "600" },
});
