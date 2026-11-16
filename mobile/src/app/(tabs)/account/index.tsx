/**
 * Account — who you are, your wallet, the block list, the policies, and
 * deletion.
 *
 * The delete control is the reason this screen cannot be an afterthought.
 * App Store Guideline 5.1.1(v) requires an app that supports account creation
 * to also support account deletion from inside the app — pointing at the
 * website is an explicit rejection — and it has to be reachable, not buried.
 * It is one tab away from everything.
 *
 * The Wallet lives under here rather than as a tab of its own: it is
 * read-only and visited rarely, and the credit chip on Explore opens it
 * directly for the one moment someone wants it.
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
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  Avatar,
  Blurb,
  Button,
  ErrorText,
  Heading,
  LinkRow,
  Notice,
  Row,
  Screen,
} from "@/components/ui";
import { C, R } from "@/theme";
import {
  ABOUT_URL,
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

  const displayName = me?.name ?? me?.githubLogin ?? "Signed in";

  return (
    <Screen>
      {me ? (
        <>
          <View style={styles.identity}>
            <Avatar uri={me.avatarUrl} name={displayName} size={56} radius={R.avatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {displayName}
              </Text>
              {me.githubLogin ? (
                <Text style={styles.handle} numberOfLines={1}>
                  {me.githubLogin}
                </Text>
              ) : null}
            </View>
          </View>

          <Pressable
            onPress={() => router.push("/wallet")}
            style={({ pressed }) => [styles.wallet, pressed && { opacity: 0.85 }]}
            android_ripple={{ color: "rgba(255,255,255,0.06)", foreground: true }}
            accessibilityRole="button"
            accessibilityLabel={`Wallet, ${me.creditBalance} ${me.creditBalance === 1 ? "credit" : "credits"}`}
            accessibilityHint="Opens your wallet and credit history">
            <View style={styles.walletIcon}>
              <Ionicons name="wallet-outline" size={20} color={C.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.walletTitle}>Wallet</Text>
              <Text style={styles.walletSub}>
                {me.mintEligible
                  ? "Credits earned for verified stars"
                  : "Not yet eligible to earn credits"}
              </Text>
            </View>
            <Text style={styles.walletBalance}>{me.creditBalance}</Text>
            <Ionicons name="chevron-forward" size={18} color={C.faint} />
          </Pressable>
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
          You haven&rsquo;t blocked anyone. Open the &bull;&bull;&bull; menu on
          any repo to report it or block the account that posted it.
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
      {/* Opened in the browser rather than rebuilt as a screen, like the
          policies below and for the same reason: /about is a factual-accuracy
          surface whose every claim is derived from the server's code, so a copy
          frozen into a signed binary is the one thing it must not be. */}
      <LinkRow
        label="About repoherald"
        onPress={() => {
          WebBrowser.openBrowserAsync(ABOUT_URL).catch(() =>
            setError("Couldn't open that page.")
          );
        }}
      />

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
  identity: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 },
  name: { color: C.text, fontSize: 18, fontWeight: "700" },
  handle: { color: C.dim, fontSize: 14, marginTop: 2 },
  wallet: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.card,
    borderRadius: R.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    padding: 14,
    minHeight: 64,
    overflow: "hidden",
  },
  walletIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(157,120,255,0.14)",
  },
  walletTitle: { color: C.text, fontSize: 15, fontWeight: "700" },
  walletSub: { color: C.dim, fontSize: 12, marginTop: 2 },
  walletBalance: { color: C.text, fontSize: 20, fontWeight: "800" },
  unblock: { color: C.accent, fontSize: 15, fontWeight: "600" },
});
