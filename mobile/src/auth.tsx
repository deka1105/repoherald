/**
 * Sign-in, and the token that survives app restarts.
 *
 * GitHub OAuth runs on the device with PKCE, so no client secret ships in the
 * binary. The resulting GitHub token is exchanged *once* for a repoherald
 * bearer token and then discarded — the app never stores a GitHub credential,
 * only ours, which is scoped to this app and expires in 30 days.
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { GITHUB_CLIENT_ID, GITHUB_SCOPES } from "./config";
import { exchangeGithubToken, getMe, setToken, AuthError, type Me } from "./api";

WebBrowser.maybeCompleteAuthSession();

const TOKEN_KEY = "repoherald.token";

const discovery = {
  authorizationEndpoint: "https://github.com/login/oauth/authorize",
  tokenEndpoint: "https://github.com/login/oauth/access_token",
};

type AuthState = {
  me: Me | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const clear = useCallback(async () => {
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
      if (e instanceof AuthError) await clear();
    }
  }, [clear]);

  // Restore a stored session on launch.
  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(TOKEN_KEY);
        if (stored) {
          setToken(stored);
          await refresh();
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  const signIn = useCallback(async () => {
    const redirectUri = AuthSession.makeRedirectUri({ scheme: "repoherald" });
    const request = new AuthSession.AuthRequest({
      clientId: GITHUB_CLIENT_ID,
      scopes: GITHUB_SCOPES,
      redirectUri,
      usePKCE: true,
    });

    const result = await request.promptAsync(discovery);
    if (result.type !== "success" || !result.params.code) return;

    const tokenResult = await AuthSession.exchangeCodeAsync(
      {
        clientId: GITHUB_CLIENT_ID,
        code: result.params.code,
        redirectUri,
        extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : undefined,
      },
      discovery
    );
    if (!tokenResult.accessToken) return;

    const { token } = await exchangeGithubToken(tokenResult.accessToken);
    setToken(token);
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await refresh();
  }, [refresh]);

  return (
    <Ctx.Provider value={{ me, loading, signIn, signOut: clear, refresh }}>
      {children}
    </Ctx.Provider>
  );
}
