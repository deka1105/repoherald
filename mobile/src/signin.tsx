/**
 * Sign-in sheet.
 *
 * Apple is listed first and on iOS only. Guideline 4.8 asks for a
 * privacy-preserving login option alongside third-party ones; putting it at the
 * top also matches Apple's own guidance on presenting it no less prominently
 * than the alternatives.
 *
 * Nothing here is required to read the feed — the sheet is only ever opened by
 * tapping "Sign in". An app that demands an account before showing content is
 * rejected under Guideline 5.1.1(i), and the feed is public on the web anyway.
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { C, ANDROID_TOP_INSET } from "./theme";
import { PRIVACY_URL, TERMS_URL } from "./config";
import { useAuth, type SignInMethod } from "./auth";

export function SignInSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { signIn, busy, appleAvailable } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const attempt = async (method: SignInMethod) => {
    setError(null);
    try {
      await signIn(method);
      onClose();
    } catch {
      setError("That didn't work. Please try again.");
    }
  };

  const options: { method: SignInMethod; label: string; primary?: boolean }[] = [
    ...(appleAvailable
      ? [{ method: "apple" as const, label: "Continue with Apple", primary: true }]
      : []),
    { method: "github", label: "Continue with GitHub" },
    { method: "google", label: "Continue with Google" },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.bar}>
          <Text style={styles.title}>Sign in</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={12}>
            <Text style={styles.close}>Done</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={styles.blurb}>
            Sign in to earn credits for starring repos you like. Browsing
            doesn&apos;t need an account.
          </Text>

          {options.map((o) => (
            <Pressable
              key={o.method}
              style={[styles.button, o.primary && styles.buttonPrimary]}
              disabled={busy}
              onPress={() => attempt(o.method)}
              accessibilityRole="button"
              accessibilityLabel={o.label}>
              <Text
                style={[styles.buttonText, o.primary && styles.buttonTextPrimary]}>
                {o.label}
              </Text>
            </Pressable>
          ))}

          {busy ? (
            <ActivityIndicator color={C.accent} style={{ marginTop: 20 }} />
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.legal}>
            By signing in you agree to our{" "}
            <Text style={styles.link} onPress={() => Linking.openURL(TERMS_URL)}>
              Terms
            </Text>{" "}
            and{" "}
            <Text style={styles.link} onPress={() => Linking.openURL(PRIVACY_URL)}>
              Privacy Policy
            </Text>
            .
          </Text>
        </View>
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
  body: { padding: 20, maxWidth: 520, width: "100%", alignSelf: "center" },
  blurb: { color: C.body, fontSize: 15, lineHeight: 22, marginBottom: 24 },
  button: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 12,
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
  },
  buttonPrimary: { backgroundColor: C.text, borderColor: C.text },
  buttonText: { color: C.text, fontSize: 16, fontWeight: "600" },
  buttonTextPrimary: { color: C.bg },
  error: { color: C.danger, fontSize: 14, marginTop: 16, textAlign: "center" },
  legal: { color: C.dim, fontSize: 12, lineHeight: 18, marginTop: 24 },
  link: { color: C.accent, textDecorationLine: "underline" },
});
