/**
 * The header's share button, for a repo or a list.
 *
 * Shares the *website* URL, not a `repoherald://` one: the person receiving it
 * may not have the app, and with universal links set up the same https link
 * opens the app for those who do (see `+native-intent.tsx`).
 *
 * iOS takes `url` separately so the share sheet can render a link preview;
 * Android has no such field, so the link goes in the message.
 */
import React from "react";
import { Platform, Pressable, Share } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { API_BASE } from "@/config";
import { C } from "@/theme";
import { tick } from "./ui";

export function ShareButton({ path, title }: { path: string; title: string }) {
  const url = `${API_BASE}${path}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Share ${title}`}
      hitSlop={12}
      onPress={() => {
        tick();
        Share.share(
          Platform.OS === "ios" ? { url, message: title } : { message: `${title}\n${url}`, title }
        ).catch(() => {});
      }}>
      <Ionicons
        name={Platform.OS === "ios" ? "share-outline" : "share-social-outline"}
        size={22}
        color={C.text}
      />
    </Pressable>
  );
}
