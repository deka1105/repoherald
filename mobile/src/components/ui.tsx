/**
 * The small set of primitives every screen is built from.
 *
 * Deliberately hand-rolled rather than a component library: the app is dark
 * only, six screens wide, and a dependency here would be a native module to
 * keep in step with every Expo SDK bump for the sake of a button.
 */
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from "react-native";
import { C, CONTENT_MAX_WIDTH } from "@/theme";

/** The reading column. Caps width on iPad, where app.json keeps
 *  `supportsTablet: true` and the app is reviewed on a 13" screen. */
export function Column({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.column, style]}>{children}</View>;
}

export function Screen({
  children,
  scroll = true,
  refreshControl,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  refreshControl?: React.ReactElement;
}) {
  if (!scroll) {
    return <View style={styles.screen}>{children}</View>;
  }
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollBody}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}>
      <Column>{children}</Column>
    </ScrollView>
  );
}

export function Loading() {
  return (
    <View style={styles.centre}>
      <ActivityIndicator color={C.accent} />
    </View>
  );
}

export function Heading({ children }: { children: React.ReactNode }) {
  return <Text style={styles.heading}>{children}</Text>;
}

export function Blurb({ children }: { children: React.ReactNode }) {
  return <Text style={styles.blurb}>{children}</Text>;
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  return <Text style={styles.error}>{children}</Text>;
}

export function Notice({ children }: { children: React.ReactNode }) {
  return <Text style={styles.notice}>{children}</Text>;
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>
      {typeof value === "string" || typeof value === "number" ? (
        <Text style={styles.rowValue}>{value}</Text>
      ) : (
        value
      )}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  busy,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "destructive";
  disabled?: boolean;
  busy?: boolean;
  accessibilityLabel?: string;
}) {
  const box =
    variant === "primary"
      ? styles.btnPrimary
      : variant === "destructive"
        ? styles.btnDestructive
        : styles.btnSecondary;
  const text =
    variant === "primary"
      ? styles.btnPrimaryText
      : variant === "destructive"
        ? styles.btnDestructiveText
        : styles.btnSecondaryText;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.btn,
        box,
        (disabled || busy) && styles.btnDisabled,
        pressed && !disabled && !busy && styles.btnPressed,
      ]}
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || busy), busy }}
      accessibilityLabel={accessibilityLabel ?? label}>
      {busy ? (
        <ActivityIndicator color={variant === "primary" ? C.bg : C.text} />
      ) : (
        <Text style={text}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  ...props
}: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={C.dim}
        // Dark-only app: without this the iOS keyboard comes up white and the
        // caret is nearly invisible against the card.
        keyboardAppearance="dark"
        accessibilityLabel={label}
        {...props}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

/** A tappable row that reads as a link rather than a button. */
export function LinkRow({
  label,
  onPress,
  detail,
}: {
  label: string;
  onPress: () => void;
  detail?: string;
}) {
  return (
    <Pressable
      style={styles.linkRow}
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}>
      <Text style={styles.linkText}>{label}</Text>
      {detail ? <Text style={styles.rowLabel}>{detail}</Text> : null}
    </Pressable>
  );
}

export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{children}</Text>
    </View>
  );
}

/** "3 days ago" — the same shape the web's `timeAgo` renders. */
export function timeAgo(iso: string | Date): string {
  const then = typeof iso === "string" ? Date.parse(iso) : iso.getTime();
  if (!Number.isFinite(then)) return "";
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scrollBody: {
    padding: 16,
    // Clears the tab bar, which overlays the end of a scroll view.
    paddingBottom: Platform.OS === "android" ? 112 : 96,
  },
  column: { width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center" },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  heading: {
    color: C.dim,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 28,
    marginBottom: 8,
  },
  blurb: { color: C.body, fontSize: 15, lineHeight: 22 },
  notice: { color: C.dim, fontSize: 12, lineHeight: 18, marginTop: 10 },
  error: { color: C.danger, fontSize: 14, marginTop: 12, lineHeight: 20 },
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  rowLabel: { color: C.body, fontSize: 15, flexShrink: 1 },
  rowValue: { color: C.text, fontSize: 15, fontWeight: "600" },
  btn: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    minHeight: 48,
  },
  btnPressed: { opacity: 0.75 },
  btnDisabled: { opacity: 0.45 },
  btnPrimary: { backgroundColor: C.accent },
  btnPrimaryText: { color: "#120b24", fontSize: 16, fontWeight: "700" },
  btnSecondary: {
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
  },
  btnSecondaryText: { color: C.text, fontSize: 16, fontWeight: "600" },
  btnDestructive: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.danger,
  },
  btnDestructiveText: { color: C.danger, fontSize: 16, fontWeight: "600" },
  field: { marginTop: 16 },
  fieldLabel: {
    color: C.body,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 7,
  },
  input: {
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: C.text,
    fontSize: 16,
    minHeight: 48,
  },
  hint: { color: C.dim, fontSize: 12, lineHeight: 17, marginTop: 6 },
  linkRow: { paddingVertical: 13 },
  linkText: { color: C.accent, fontSize: 15 },
  pill: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: { color: C.dim, fontSize: 12 },
});
