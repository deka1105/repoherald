/**
 * Account sheet: who you are, sign out, and delete.
 *
 * The delete control is the reason this screen exists. App Store Guideline
 * 5.1.1(v) requires an app that supports account creation to also support
 * account deletion from inside the app — pointing at the website is an
 * explicit rejection — and it has to be reachable, not buried. It sits one tap
 * from the feed's account button.
 *
 * There is deliberately no way to *buy* credits here. Selling a digital
 * currency outside In-App Purchase breaks Guideline 3.1.1, and even linking out
 * to a web purchase flow is a fight not worth having, so the app does not
 * mention one.
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { C, ANDROID_TOP_INSET } from "./theme";
import { PRIVACY_URL, SUPPORT_URL, TERMS_URL } from "./config";
import { useAuth } from "./auth";
import { unblockOwner } from "./blocks";

export function AccountSheet({
  visible,
  onClose,
  blocked,
  onUnblock,
}: {
  visible: boolean;
  onClose: () => void;
  /** Owner logins this device has blocked. Guideline 1.2. */
  blocked: string[];
  onUnblock: (next: string[]) => void;
}) {
  const { me, busy, signOut, deleteAccount } = useAuth();
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
              onClose();
            } catch {
              setError("Couldn't delete your account. Please try again.");
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.bar}>
          <Text style={styles.title}>Account</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={12}>
            <Text style={styles.close}>Done</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {me ? (
            <>
              <View style={styles.identity}>
                {me.avatarUrl ? (
                  <Image
                    source={{ uri: me.avatarUrl }}
                    style={styles.avatar}
                    contentFit="cover"
                  />
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

              <View style={styles.row}>
                <Text style={styles.rowLabel}>Credits</Text>
                <Text style={styles.rowValue}>{me.creditBalance}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Can earn credits</Text>
                <Text style={styles.rowValue}>
                  {me.mintEligible ? "Yes" : "Not yet"}
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.blurb}>You are not signed in.</Text>
          )}

          {/* Blocking has to be undoable, or it is a trap rather than a
              control. This list is the only place a block can be lifted. */}
          <Text style={styles.heading}>Blocked accounts</Text>
          {blocked.length === 0 ? (
            <Text style={styles.blurb}>
              You haven&rsquo;t blocked anyone. Tap &bull;&bull;&bull; on any
              repo to report it or block the account that posted it.
            </Text>
          ) : (
            blocked.map((owner) => (
              <View key={owner} style={styles.row}>
                <Text style={styles.rowLabel} numberOfLines={1}>
                  {owner}
                </Text>
                <Pressable
                  onPress={async () => {
                    try {
                      onUnblock(await unblockOwner(owner));
                    } catch {
                      setError("Couldn't unblock that account.");
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Unblock ${owner}`}
                  hitSlop={10}>
                  <Text style={styles.unblock}>Unblock</Text>
                </Pressable>
              </View>
            ))
          )}

          <Text style={styles.heading}>About</Text>
          {[
            { label: "Privacy Policy", url: PRIVACY_URL },
            { label: "Terms of Service", url: TERMS_URL },
            { label: "Support", url: SUPPORT_URL },
          ].map((l) => (
            <Pressable
              key={l.url}
              style={styles.link}
              onPress={() => Linking.openURL(l.url)}
              accessibilityRole="link"
              accessibilityLabel={l.label}>
              <Text style={styles.linkText}>{l.label}</Text>
            </Pressable>
          ))}

          {me ? (
            <>
              <Pressable
                style={styles.secondary}
                disabled={busy}
                onPress={signOut}
                accessibilityRole="button"
                accessibilityLabel="Sign out">
                <Text style={styles.secondaryText}>Sign out</Text>
              </Pressable>

              <Text style={styles.heading}>Danger zone</Text>
              <Pressable
                style={styles.destructive}
                disabled={busy}
                onPress={confirmDelete}
                accessibilityRole="button"
                accessibilityLabel="Delete my account">
                <Text style={styles.destructiveText}>Delete my account</Text>
              </Pressable>
              <Text style={styles.note}>
                Deletes your profile and GitHub connection and hides your posts.
                Credit history is kept anonymised for accounting integrity.
              </Text>
            </>
          ) : null}

          {busy ? (
            <ActivityIndicator color={C.accent} style={{ marginTop: 20 }} />
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingTop: ANDROID_TOP_INSET },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  title: { color: C.text, fontSize: 18, fontWeight: "700" },
  close: { color: C.accent, fontSize: 16, fontWeight: "600" },
  body: {
    padding: 20,
    paddingBottom: 48,
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
  },
  identity: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 14 },
  name: { color: C.text, fontSize: 18, fontWeight: "700" },
  handle: { color: C.dim, fontSize: 14, marginTop: 2 },
  blurb: { color: C.body, fontSize: 15, lineHeight: 22 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  rowLabel: { color: C.body, fontSize: 15 },
  rowValue: { color: C.text, fontSize: 15, fontWeight: "600" },
  unblock: { color: C.accent, fontSize: 15, fontWeight: "600" },
  heading: {
    color: C.dim,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 32,
    marginBottom: 8,
  },
  link: { paddingVertical: 13 },
  linkText: { color: C.accent, fontSize: 15 },
  secondary: {
    marginTop: 28,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
  },
  secondaryText: { color: C.text, fontSize: 16, fontWeight: "600" },
  destructive: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.danger,
  },
  destructiveText: { color: C.danger, fontSize: 16, fontWeight: "600" },
  note: { color: C.dim, fontSize: 12, lineHeight: 18, marginTop: 10 },
  error: { color: C.danger, fontSize: 14, marginTop: 16, textAlign: "center" },
});
