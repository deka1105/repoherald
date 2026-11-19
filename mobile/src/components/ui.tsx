/**
 * The small set of primitives every screen is built from.
 *
 * Deliberately hand-rolled rather than a component library: the app is dark
 * only, a handful of screens wide, and a dependency here would be a native
 * module to keep in step with every Expo SDK bump for the sake of a button.
 *
 * What *is* native is the chrome around these: tab bar, navigation bars and
 * the iOS search field come from the system (see `(tabs)/_layout.tsx`), so
 * Liquid Glass on iOS 26 and Material 3 on Android arrive without a second
 * visual system being maintained here. These primitives only have to look
 * right *inside* a card.
 */
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  type RefreshControlProps,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ColorValue,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { GlassView } from "expo-glass-effect";
import { useSafeAreaInsets } from "react-native-safe-area-context";
// Its own entry point, not the package root: the root re-exports every icon
// set and Metro then bundles ~3MB of fonts for the sake of a few glyphs.
import Ionicons from "@expo/vector-icons/Ionicons";
import { C, CONTENT_MAX_WIDTH, LIQUID_GLASS, R } from "@/theme";

export type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

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

/**
 * A scrolling page.
 *
 * `contentInsetAdjustmentBehavior="automatic"` is what lets the iOS header be
 * glass: the bar is transparent and floats, and the scroll view asks UIKit how
 * far down to start so content begins under the title and slides beneath it.
 * Inside the native tabs it also clears the tab bar. Android bars are solid
 * and sit outside the content, so there the only inset to add by hand is the
 * system navigation bar on an edge-to-edge device.
 */
export function Screen({
  children,
  scroll = true,
  refreshControl,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}) {
  const insets = useSafeAreaInsets();
  if (!scroll) {
    return <View style={styles.screen}>{children}</View>;
  }
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.scrollBody,
        { paddingBottom: 24 + (Platform.OS === "android" ? insets.bottom : 0) },
      ]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
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

/**
 * The button.
 *
 * A disabled primary is grey, not a faded purple. Fading the brand colour
 * reads as "purple, but dim" — indistinguishable at a glance from an enabled
 * button on a dark screen — so a form whose submit was waiting on input looked
 * broken before anyone typed. Grey with grey text can only mean "not yet", and
 * the moment the form is valid it snaps to full brightness.
 */
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
  const off = Boolean(disabled) && !busy;
  const box =
    variant === "primary"
      ? off
        ? styles.btnPrimaryOff
        : styles.btnPrimary
      : variant === "destructive"
        ? styles.btnDestructive
        : styles.btnSecondary;
  const text =
    variant === "primary"
      ? off
        ? styles.btnPrimaryTextOff
        : styles.btnPrimaryText
      : variant === "destructive"
        ? styles.btnDestructiveText
        : styles.btnSecondaryText;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.btn,
        box,
        off && variant !== "primary" && styles.btnFaded,
        pressed && !disabled && !busy && styles.btnPressed,
      ]}
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || busy), busy }}
      accessibilityLabel={accessibilityLabel ?? label}>
      {busy ? (
        <ActivityIndicator color={variant === "primary" ? C.onAccent : C.text} />
      ) : (
        <Text style={text}>{label}</Text>
      )}
    </Pressable>
  );
}

/** A 44pt square tap target around a single glyph. */
export function IconButton({
  name,
  label,
  onPress,
  color = C.dim,
  size = 20,
  style,
}: {
  name: IoniconName;
  /** Spoken by VoiceOver and TalkBack; the glyph itself says nothing. */
  label: string;
  onPress: () => void;
  color?: ColorValue;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.iconBtn, pressed && styles.btnPressed, style]}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <Ionicons name={name} size={size} color={color} />
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  style,
  ...props
}: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        // Merged rather than spread over: `style` used to arrive with the rest
        // of the props and replace the base input entirely, so any caller that
        // wanted only a taller box silently lost the border, padding and text
        // colour with it.
        style={[styles.input, style]}
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

/**
 * A toggleable chip, for picking several from a set (the Post screen's
 * categories). For picking exactly one, use `Segments`.
 */
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      // The chip is 36pt tall; the slop carries it to the 44pt touch floor
      // without a taller box crowding the row.
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipOn,
        pressed && styles.btnPressed,
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}>
      {selected ? (
        <Ionicons name="checkmark" size={14} color={C.onAccent} />
      ) : null}
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

/**
 * A single-choice control that never wraps.
 *
 * Sort options used to be free-floating pills in a wrapping row, so on a
 * narrow phone the last one orphaned onto a second line. These sit in one
 * horizontally scrolling row instead, drawn the way each platform draws its
 * own: on iOS a capsule container (Liquid Glass on 26, a plain capsule
 * before it) with the selection filled, and on Android a Material 3 connected
 * button group — adjoining segments with a 2dp gap, the selected one rounding
 * out to a pill.
 */
export function Segments<T extends string | undefined>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  /** What is being chosen, for screen readers: "Sort". */
  label: string;
}) {
  const ios = Platform.OS === "ios";
  const last = options.length - 1;
  const items = options.map((o, i) => {
    const on = o.key === value;
    return (
      <Pressable
        key={o.label}
        onPress={() => onChange(o.key)}
        // iOS: a 38pt segment plus 3pt above and below reaches 44pt and stops
        // at the group's edge — a slop past the ScrollView would be clipped.
        hitSlop={ios ? { top: 3, bottom: 3 } : 4}
        style={({ pressed }) => [
          ios ? styles.segIos : styles.segAndroid,
          // The group's outer corners are full pills; only the seams between
          // segments are the tighter radius.
          !ios && i === 0 && styles.segAndroidFirst,
          !ios && i === last && styles.segAndroidLast,
          on && (ios ? styles.segIosOn : styles.segAndroidOn),
          pressed && !on && styles.btnPressed,
        ]}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        accessibilityLabel={`${label}: ${o.label}`}>
        <Text style={[styles.segText, on && styles.segTextOn]}>{o.label}</Text>
      </Pressable>
    );
  });

  let group: React.ReactNode;
  if (!ios) {
    group = <View style={styles.segGroupAndroid}>{items}</View>;
  } else if (LIQUID_GLASS) {
    group = (
      <GlassView glassEffectStyle="regular" style={styles.segGroupGlass}>
        {items}
      </GlassView>
    );
  } else {
    group = <View style={styles.segGroupIos}>{items}</View>;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Never bounces past the tab bar's edge-fade: these are controls, not
      // content, and an over-scroll here reads as a broken row.
      bounces={false}
      contentContainerStyle={styles.segScroll}
      accessibilityRole="tablist"
      accessibilityLabel={label}>
      {group}
    </ScrollView>
  );
}

/**
 * A repo or account avatar, with a real fallback.
 *
 * GitHub serves an avatar for every owner, but a listing can arrive without
 * one, and a flat grey square next to cards that all have logos reads as an
 * image that failed to load. The fallback is the first letter on a tint
 * derived from the name, so it is stable across renders and distinct between
 * neighbours. Letter contrast on the tint is 7:1 or better at every hue — the
 * lightness is fixed and only the hue moves.
 */
export function Avatar({
  uri,
  name,
  size = 38,
  radius = R.avatar,
  style,
}: {
  uri: string | null | undefined;
  name: string;
  size?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const box = { width: size, height: size, borderRadius: Math.min(radius, size / 2) };
  if (uri) {
    return (
      <Image
        source={{ uri }}
        // expo-image types its style as ImageStyle; the layout props callers
        // pass (margins, flex) are common to both.
        style={[box, style as StyleProp<ImageStyle>]}
        contentFit="cover"
        // Disk-cached by default; the recycling key lets a FlatList reuse the
        // native view for a different repo without flashing the old logo.
        recyclingKey={uri}
        transition={120}
        accessible={false}
      />
    );
  }
  const initial = (name.trim().replace(/^[^a-z0-9]+/i, "")[0] ?? "?").toUpperCase();
  return (
    <View
      style={[box, styles.avatarFallback, { backgroundColor: tint(name) }, style]}
      accessible={false}>
      <Text style={[styles.avatarInitial, { fontSize: Math.round(size * 0.44) }]}>
        {initial}
      </Text>
    </View>
  );
}

/** A dark, saturated hue picked from the string — the same name always gets
 *  the same colour. Lightness is fixed at 32% so white text clears 7:1. */
function tint(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 42%, 32%)`;
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
  scrollBody: { padding: 16 },
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
    borderRadius: R.card,
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
    borderRadius: R.pill,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    minHeight: 48,
  },
  btnPressed: { opacity: 0.75 },
  btnFaded: { opacity: 0.45 },
  btnPrimary: { backgroundColor: C.accent },
  btnPrimaryText: { color: C.onAccent, fontSize: 16, fontWeight: "700" },
  btnPrimaryOff: { backgroundColor: C.line },
  btnPrimaryTextOff: { color: C.dim, fontSize: 16, fontWeight: "700" },
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
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
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
    borderRadius: R.control,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: C.text,
    fontSize: 16,
    minHeight: 48,
  },
  hint: { color: C.dim, fontSize: 12, lineHeight: 17, marginTop: 6 },
  linkRow: { paddingVertical: 13, minHeight: 44, justifyContent: "center" },
  linkText: { color: C.accent, fontSize: 15 },
  pill: {
    borderRadius: R.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: { color: C.dim, fontSize: 12 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: R.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    backgroundColor: C.card,
    paddingHorizontal: 14,
    minHeight: 36,
  },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: C.body, fontSize: 13, fontWeight: "600" },
  chipTextOn: { color: C.onAccent },
  segScroll: { flexGrow: 1, paddingRight: 4 },
  segGroupIos: {
    flexDirection: "row",
    backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    borderRadius: R.pill,
    padding: 3,
  },
  segGroupGlass: {
    flexDirection: "row",
    borderRadius: R.pill,
    overflow: "hidden",
    padding: 3,
  },
  segIos: {
    paddingHorizontal: 14,
    minHeight: 38,
    justifyContent: "center",
    borderRadius: R.pill,
  },
  segIosOn: { backgroundColor: C.accent },
  segGroupAndroid: { flexDirection: "row", gap: 2 },
  segAndroid: {
    paddingHorizontal: 16,
    minHeight: 38,
    justifyContent: "center",
    backgroundColor: C.card,
    borderRadius: 8,
  },
  segAndroidFirst: { borderTopLeftRadius: R.pill, borderBottomLeftRadius: R.pill },
  segAndroidLast: { borderTopRightRadius: R.pill, borderBottomRightRadius: R.pill },
  segAndroidOn: {
    backgroundColor: C.accent,
    borderRadius: R.pill,
    borderTopLeftRadius: R.pill,
    borderBottomLeftRadius: R.pill,
    borderTopRightRadius: R.pill,
    borderBottomRightRadius: R.pill,
  },
  segText: { color: C.body, fontSize: 13, fontWeight: "600" },
  segTextOn: { color: C.onAccent, fontWeight: "700" },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: "#ffffff", fontWeight: "700" },
});
