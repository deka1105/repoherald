/**
 * Push notifications.
 *
 * What is sent is decided on the server (src/lib/push.ts): someone donating
 * highlight time to a repo you posted, credits arriving that you did not just
 * tap for, and a highlight you paid for finishing. This side only registers the
 * device and opens the screen a notification points at.
 *
 * Permission is asked once, after sign-in — never at launch, when there is no
 * account for a notification to be about. A refusal is final from the app's
 * side; iOS will not show the prompt twice, and the user can change it in
 * Settings.
 *
 * Every function here swallows its errors. A device that cannot get a token
 * (a simulator, Android without Firebase configured, no network) must lose
 * notifications, never the app.
 */
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { registerPushToken, unregisterPushToken } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let registered: string | null = null;

export async function registerForPush(): Promise<void> {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Activity",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status === "undetermined") {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== "granted") return;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token || token === registered) return;

    await registerPushToken(token, Platform.OS === "ios" ? "ios" : "android");
    registered = token;
  } catch {
    // See the header: no token is not an error worth surfacing.
  }
}

/** Called on sign-out, while the bearer token still exists to authorise it. */
export async function unregisterPush(): Promise<void> {
  const token = registered;
  registered = null;
  if (!token) return;
  try {
    await unregisterPushToken(token);
  } catch {
    // The server also prunes tokens Expo reports as unregistered.
  }
}

/**
 * The in-app path a notification points at, or null. Only app-relative paths
 * are honoured — a payload is server-written, but the router should never be
 * handed an external URL from one regardless.
 */
export function pathFromNotification(
  response: Notifications.NotificationResponse | null | undefined
): string | null {
  const path = response?.notification.request.content.data?.path;
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//")
    ? path
    : null;
}
