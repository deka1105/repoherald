/**
 * Sign-in, and the token that survives app restarts.
 *
 * Identity is Clerk's, exactly as on the web — the app no longer runs its own
 * GitHub OAuth. That matters for two reasons: the same human signing in here
 * and on the website lands on one account, and App Store Guideline 4.8 (an app
 * offering third-party login must also offer a privacy-preserving option) is
 * satisfied by enabling Sign in with Apple in the Clerk dashboard instead of
 * by writing a second OAuth client.
 *
 * Two tokens are in play, which is worth being clear about:
 *
 *   Clerk's session token — lives about a minute, refreshed by @clerk/expo,
 *       persisted by its own tokenCache. Proof of identity, used once.
 *   Our bearer token — 30 days, minted by /api/mobile/v1/session, stored in
 *       SecureStore and sent on every API call. See src/lib/mobile-auth.ts on
 *       the server for why the app holds a long-lived token of its own rather
 *       than attaching a Clerk token that expires mid-scroll and throws when
 *       the device is offline.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { useAuth as useClerkAuth, useSSO } from "@clerk/expo";
import { useSignInWithApple } from "@clerk/expo/apple";
import { SSO_REDIRECT_PATH } from "./config";
import {
  exchangeClerkToken,
  getMe,
  deleteAccount as deleteAccountRequest,
  setToken,
  AuthError,
  type Me,
} from "./api";

WebBrowser.maybeCompleteAuthSession();

const TOKEN_KEY = "repoherald.token";

export type SignInMethod = "github" | "google" | "apple";

type AuthState = {
  me: Me | null;
  /** True until we know whether this launch is signed in. */
  loading: boolean;
  /** Set while a sign-in, sign-out or deletion is in flight. */
  busy: boolean;
  /** Apple's native sheet is iOS-only; the button must not render elsewhere. */
  appleAvailable: boolean;
  signIn: (method: SignInMethod) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const {
    isLoaded: clerkLoaded,
    isSignedIn,
    getToken,
    signOut: clerkSignOut,
  } = useClerkAuth();
  const { startSSOFlow } = useSSO();
  const { startAppleAuthenticationFlow } = useSignInWithApple();

  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Guards the establish-session effect. Without it, a re-render while the
  // exchange is in flight would start a second one and mint a second token.
  const settling = useRef(false);

  const forgetLocal = useCallback(async () => {
    setToken(null);
    setMe(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    try {
      const { user } = await getMe();
      setMe(user);
    } catch (e) {
      // Only an auth failure means signed-out. A network blip must not throw
      // the user back to the sign-in screen.
      if (e instanceof AuthError) await forgetLocal();
    }
  }, [forgetLocal]);

  /** Mint and store a bearer token from the current Clerk session. */
  const establish = useCallback(async () => {
    const clerkToken = await getToken();
    if (!clerkToken) return false;
    const { token } = await exchangeClerkToken(clerkToken);
    setToken(token);
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    return true;
  }, [getToken]);

  // Reconcile Clerk's view of the session with our stored token, on launch and
  // whenever Clerk's state changes.
  useEffect(() => {
    if (!clerkLoaded || settling.current) return;

    settling.current = true;
    (async () => {
      try {
        if (!isSignedIn) {
          await forgetLocal();
          return;
        }

        const stored = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
        if (stored) {
          setToken(stored);
          try {
            const { user } = await getMe();
            setMe(user);
            return;
          } catch (e) {
            // Expired, or minted for an account that has since been deleted.
            // Clerk still considers us signed in, so mint a fresh one rather
            // than showing a signed-out app.
            if (!(e instanceof AuthError)) return;
            await forgetLocal();
          }
        }

        if (await establish()) await refresh();
      } finally {
        settling.current = false;
        setLoading(false);
      }
    })();
  }, [clerkLoaded, isSignedIn, establish, forgetLocal, refresh]);

  const signIn = useCallback(
    async (method: SignInMethod) => {
      setBusy(true);
      try {
        if (method === "apple") {
          const { createdSessionId, setActive } =
            await startAppleAuthenticationFlow();
          if (createdSessionId && setActive) {
            await setActive({ session: createdSessionId });
          }
          return;
        }

        const { createdSessionId, setActive } = await startSSOFlow({
          strategy: method === "github" ? "oauth_github" : "oauth_google",
          redirectUrl: AuthSession.makeRedirectUri({
            scheme: "repoherald",
            path: SSO_REDIRECT_PATH,
          }),
        });
        if (createdSessionId && setActive) {
          await setActive({ session: createdSessionId });
        }
        // A null createdSessionId means Clerk wants more information before it
        // will open a session. There is nothing to collect in this app, so the
        // flow simply ends and the sign-in screen stays put.
      } catch (e) {
        // Cancelling the Apple sheet or closing the browser is not an error.
        const code = (e as { code?: string } | null)?.code;
        if (code !== "ERR_REQUEST_CANCELED") throw e;
      } finally {
        setBusy(false);
      }
      // The effect above sees Clerk flip to signed-in and does the exchange.
    },
    [startSSOFlow, startAppleAuthenticationFlow]
  );

  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      await forgetLocal();
      await clerkSignOut().catch(() => {});
    } finally {
      setBusy(false);
    }
  }, [forgetLocal, clerkSignOut]);

  const deleteAccount = useCallback(async () => {
    setBusy(true);
    try {
      await deleteAccountRequest();
      await forgetLocal();
      // The server has already deleted the Clerk user, so this call is
      // expected to fail; it runs to clear the cached session on *this* device.
      await clerkSignOut().catch(() => {});
    } finally {
      setBusy(false);
    }
  }, [forgetLocal, clerkSignOut]);

  return (
    <Ctx.Provider
      value={{
        me,
        loading: loading || !clerkLoaded,
        busy,
        appleAvailable: Platform.OS === "ios",
        signIn,
        signOut,
        deleteAccount,
        refresh,
      }}>
      {children}
    </Ctx.Provider>
  );
}
