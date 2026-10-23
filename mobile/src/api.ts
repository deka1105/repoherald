/**
 * Client for the repoherald mobile API.
 *
 * Every call goes through `request`, which attaches the bearer token when one
 * is held, turns a 401 into a thrown AuthError — so the UI has exactly one
 * place to decide "we have been signed out" — and lifts the server's own
 * `error` string onto the thrown ApiError. That last part matters: the rules
 * this app has to explain (claim caps, the self-star refusal, a full list) are
 * all enforced server-side and worded there, so re-wording them here would be
 * two copies of the same policy waiting to disagree.
 */
import { API_BASE } from "./config";

export class AuthError extends Error {}
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

/** A repo as the feed, search and list endpoints all render it. */
export type RepoSummary = {
  id: string;
  /**
   * "owner/name" — the ONLY name these endpoints send. `src/lib/feed.ts` has
   * never returned separate `name`/`ownerLogin` fields; declaring them here
   * once made every card render with no title, because `request<T>` casts the
   * JSON rather than validating it. Split it instead of re-adding them.
   */
  fullName: string;
  description: string | null;
  primaryLanguage: string | null;
  starsCount: number;
  avatarUrl: string | null;
  isArchived?: boolean;
};

export type FeedRepo = RepoSummary & {
  categoryLabels?: string[];
  highlighted?: boolean;
  sponsored?: boolean;
  donationCount?: number;
  postedByLogin?: string | null;
  postedAt?: string;
  likeCount?: number;
  commentCount?: number;
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

export type SearchResult = RepoSummary & {
  /** "list" means it came from one of your own lists — the saved-folder half
   *  of search. "public" is the open feed. */
  where: "list" | "public";
  listSlug: string | null;
  listTitle: string | null;
};

export type RepoComment = {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorLogin: string | null;
  authorName: string;
  authorAvatarUrl: string | null;
  canDelete: boolean;
};

export type RepoDetail = {
  repo: RepoSummary & {
    ownerLogin: string;
    name: string;
    languages: string[];
    createdAt: string;
    postedByLogin: string | null;
    categoryLabels: string[];
    donationCount: number;
    highlightMinutes: number;
    views: number;
    visitors: number;
  };
  likeCount: number;
  comments: RepoComment[];
  viewer: {
    signedIn: true;
    liked: boolean;
    alreadyClaimed: boolean;
    isOwn: boolean;
    claimsToday: number;
    claimsThisWeek: number;
    listsMissingRepo: { id: string; title: string }[];
  } | null;
  limits: {
    dailyMintCap: number;
    weeklyMintCap: number;
    issueReportCredits: number;
  };
};

export type ListSummary = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  contributions: "open" | "closed";
  visibility: "unlisted" | "private";
  source: "manual" | "instagram" | "tiktok";
  createdAt: string;
  itemCount: number;
};

export type ListItem = {
  itemId: string;
  note: string | null;
  addedAt: string;
  addedByLogin: string | null;
  canRemove: boolean;
  repo: RepoSummary;
};

export type ListDetail = {
  list: Omit<ListSummary, "itemCount"> & {
    ownerLogin: string | null;
    isOwner: boolean;
    canAdd: boolean;
    views: number;
    visitors: number;
  };
  items: ListItem[];
  limits: { maxItems: number; noteMax: number };
};

export type LedgerEntry = {
  id: string;
  delta: number;
  type: string;
  label: string;
  memo: string | null;
  createdAt: string;
};

export type Wallet = {
  creditBalance: number;
  mintEligible: boolean;
  claims: {
    today: number;
    thisWeek: number;
    dailyCap: number;
    weeklyCap: number;
    total: number;
  };
  entries: LedgerEntry[];
  postedRepos: { id: string; fullName: string }[];
};

export type Category = { id: string; kind: string; slug: string; label: string };

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

  if (!res.ok) {
    // The server words every refusal it issues; surface that rather than a
    // generic failure, but fall back if the body isn't the shape we expect
    // (a CDN error page, say, which is not JSON at all).
    let message = `${path} failed`;
    try {
      const body: unknown = await res.json();
      if (body && typeof body === "object" && "error" in body) {
        const e = (body as { error: unknown }).error;
        if (typeof e === "string" && e) message = e;
      }
    } catch {
      // Keep the generic message.
    }
    throw new ApiError(message, res.status);
  }

  return (await res.json()) as T;
}

function qs(params: Record<string, string | undefined>) {
  const entries = Object.entries(params).filter(
    (e): e is [string, string] => Boolean(e[1])
  );
  if (entries.length === 0) return "";
  return `?${entries
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&")}`;
}

/* ── Feed ─────────────────────────────────────────────────────────────── */

export type FeedFilters = {
  language?: string;
  useCase?: string;
  sector?: string;
  q?: string;
  sort?: "donations";
};

export function getFeed(cursor?: string, filters: FeedFilters = {}) {
  return request<{
    items: FeedRepo[];
    pinned: FeedRepo[];
    nextCursor: string | null;
  }>(`/api/mobile/v1/feed${qs({ cursor, ...filters })}`);
}

/* ── Identity ─────────────────────────────────────────────────────────── */

export function getMe() {
  return request<{ user: Me }>("/api/mobile/v1/me");
}

/**
 * Trade a short-lived Clerk session token for our own 30-day bearer token.
 *
 * Deliberately not sent with the Authorization header: this is the one call
 * that has no bearer token yet, and the Clerk token is the body's payload
 * rather than this client's credential.
 */
export function exchangeClerkToken(clerkToken: string) {
  return request<{
    token: string;
    expiresAt: string;
    user: {
      id: string;
      githubLogin: string | null;
      name: string | null;
      avatarUrl: string | null;
    };
  }>("/api/mobile/v1/session", {
    method: "POST",
    body: JSON.stringify({ clerkToken }),
  });
}

/**
 * Delete the signed-in account, permanently.
 *
 * App Store Guideline 5.1.1(v) requires this to exist inside the app. The
 * server anonymises the row and deletes the Clerk user, which ends every other
 * session too; this client only has to drop its own token afterwards.
 */
export function deleteAccount() {
  return request<{ deleted: boolean }>("/api/mobile/v1/me", {
    method: "DELETE",
  });
}

/* ── Search ───────────────────────────────────────────────────────────── */

export function search(q: string) {
  return request<{ query: string; results: SearchResult[] }>(
    `/api/mobile/v1/search${qs({ q })}`
  );
}

/* ── Repo detail ──────────────────────────────────────────────────────── */

export function getRepo(id: string) {
  return request<RepoDetail>(`/api/mobile/v1/repos/${id}`);
}

export function toggleLike(id: string) {
  return request<{ liked: boolean; likeCount: number }>(
    `/api/mobile/v1/repos/${id}/like`,
    { method: "POST" }
  );
}

export function postComment(id: string, body: string) {
  return request<{ id: string; createdAt: string }>(
    `/api/mobile/v1/repos/${id}/comments`,
    { method: "POST", body: JSON.stringify({ body }) }
  );
}

export function deleteComment(commentId: string) {
  return request<{ removed: boolean }>(`/api/mobile/v1/comments/${commentId}`, {
    method: "DELETE",
  });
}

/** Verify a star on GitHub and mint the credit. */
export function claimStar(repoId: string) {
  return request<{ claimed: boolean; message?: string }>(
    `/api/mobile/v1/repos/${repoId}/claim`,
    { method: "POST" }
  );
}

/* ── Posting a repo ───────────────────────────────────────────────────── */

export function getCategories() {
  return request<{ useCases: Category[]; sectors: Category[] }>(
    "/api/mobile/v1/categories"
  );
}

export function postRepo(input: {
  url: string;
  categoryIds: string[];
  newUseCases: string;
  newSectors: string;
}) {
  return request<{ repoId: string }>("/api/mobile/v1/repos", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/* ── Lists ────────────────────────────────────────────────────────────── */

export function getLists() {
  return request<{ lists: ListSummary[]; limits: { maxLists: number } }>(
    "/api/mobile/v1/lists"
  );
}

export function createList(title: string, description: string) {
  return request<{ id: string; slug: string }>("/api/mobile/v1/lists", {
    method: "POST",
    body: JSON.stringify({ title, description }),
  });
}

export function getList(slug: string) {
  return request<ListDetail>(`/api/mobile/v1/lists/${slug}`);
}

export function deleteList(slug: string) {
  return request<{ deleted: boolean }>(`/api/mobile/v1/lists/${slug}`, {
    method: "DELETE",
  });
}

/** `repo` is a URL or "owner/name"; `repoId` is used when it's already known. */
export function addToList(
  slug: string,
  body: { repoId?: string; repo?: string; note?: string }
) {
  return request<{ itemId: string }>(`/api/mobile/v1/lists/${slug}/items`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function removeListItem(slug: string, itemId: string) {
  return request<{ removed: boolean }>(
    `/api/mobile/v1/lists/${slug}/items/${itemId}`,
    { method: "DELETE" }
  );
}

/* ── Wallet ───────────────────────────────────────────────────────────── */

export function getWallet() {
  return request<Wallet>("/api/mobile/v1/wallet");
}

/* ── Support ──────────────────────────────────────────────────────────── */

export function submitSupport(input: {
  email: string;
  subject: string;
  message: string;
}) {
  return request<{ submitted: boolean; message?: string }>(
    "/api/mobile/v1/support",
    { method: "POST", body: JSON.stringify(input) }
  );
}

/* ── Moderation ───────────────────────────────────────────────────────── */

/** The closed set the server accepts. Free text is deliberately not an option. */
export const REPORT_REASONS = [
  { key: "spam", label: "Spam or scam" },
  { key: "malware", label: "Malware or unsafe code" },
  { key: "offensive", label: "Offensive or abusive" },
  { key: "misleading", label: "Misleading or impersonation" },
  { key: "other", label: "Something else" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["key"];

/**
 * Flag a listing for moderation.
 *
 * Works signed out on purpose — browsing needs no account, so reporting must
 * not need one either, or the people most likely to see something bad have no
 * way to say so. App Store Guideline 1.2.
 */
export function reportRepo(repoId: string, reason: ReportReason) {
  return request<{ reported: boolean }>("/api/mobile/v1/report", {
    method: "POST",
    body: JSON.stringify({ repoId, reason }),
  });
}
