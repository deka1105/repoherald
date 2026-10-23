/**
 * Support — the app's version of /support.
 *
 * Open signed out, like the web form. Someone who cannot sign in is exactly
 * the person most likely to be writing, and an app whose only support channel
 * requires a working account has no support channel at all.
 *
 * For a signed-in sender the server ignores the email field and uses the
 * account address, so the field is hidden rather than pre-filled: showing an
 * editable box whose contents are discarded would be a small lie.
 */
import React, { useState } from "react";
import { Text, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { ApiError, submitSupport } from "@/api";
import { useAuth } from "@/auth";
import {
  Blurb,
  Button,
  ErrorText,
  Field,
  Notice,
  Screen,
} from "@/components/ui";
import { C } from "@/theme";

const MESSAGE_MIN = 10;

export default function SupportScreen() {
  const { me } = useAuth();

  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  if (sent) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Support" }} />
        <Text style={styles.ok}>{sent}</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: "Support" }} />
      <Blurb>
        Tell us what happened and we&rsquo;ll reply by email.
      </Blurb>

      {me ? (
        <Notice>We&rsquo;ll reply to the address on your account.</Notice>
      ) : (
        <Field
          label="Your email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          hint="So we can reply. Used for nothing else."
        />
      )}

      <Field
        label="Subject"
        value={subject}
        onChangeText={setSubject}
        placeholder="Optional"
        maxLength={150}
      />
      <Field
        label="Message"
        value={message}
        onChangeText={setMessage}
        placeholder="What's going on?"
        multiline
        numberOfLines={6}
        maxLength={5000}
        style={styles.message}
      />

      <Button
        label="Send"
        busy={busy}
        disabled={message.trim().length < MESSAGE_MIN}
        onPress={async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await submitSupport({
              email: email.trim(),
              subject: subject.trim(),
              message: message.trim(),
            });
            setSent(res.message ?? "Thanks — your message is in.");
          } catch (e) {
            setError(
              e instanceof ApiError ? e.message : "Couldn't send that. Try again."
            );
          } finally {
            setBusy(false);
          }
        }}
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  message: { minHeight: 140, textAlignVertical: "top", paddingTop: 13 },
  ok: { color: C.text, fontSize: 16, lineHeight: 24, marginTop: 24 },
});
