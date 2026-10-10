/**
 * Client for the repoherald mobile API.
 *
 * Every call goes through `request`, which attaches the bearer token when one
 * is held and turns a 401 into a thrown AuthError — so the UI has exactly one
 * place to decide "we have been signed out", rather than each screen guessing.
 */
import { API_BASE } from "./config";

export class AuthError extends Error {}
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export type FeedRepo = {
  id: string;
  fullName: string;
  ownerLogin: string;
  name: string;
  description: string | null;
  primaryLanguage: string | null;
  starsCount: number;
  avatarUrl: string | null;
};

export type Me = {
  id: string;
  githubLogin: string;
  name: string | null;
  avatarUrl: string | null;
  creditBalance: number;
  mintEligible: boolean;
  role: string;
};

let token: string | null = null;
export function setToken(t: string | null) {
  token = t;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 401) throw new AuthError("signed out");
  if (!res.ok) throw new ApiError(`${path} failed`, res.status);
  return (await res.json()) as T;
}

export function getFeed(cursor?: string) {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return request<{ items: FeedRepo[]; pinned: FeedRepo[]; nextCursor: string | null }>(
    `/api/mobile/v1/feed${q}`
  );
}

export function getMe() {
  return request<{ user: Me }>("/api/mobile/v1/me");
}

export function exchangeGithubToken(accessToken: string) {
  return request<{ token: string; expiresAt: string; user: { id: string; githubLogin: string } }>(
    "/api/mobile/v1/session",
    { method: "POST", body: JSON.stringify({ accessToken }) }
  );
}
