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
    listsMissingRepo: { id: string; slug: string; title: string }[];
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

/**
 * Where a listing was spotted: the post it came out of.
 *
 * Only present on a repo a moderator promoted from a sweep -- a repo its owner
 * posted has no reel behind it, and the card must not imply one. Carries no
 * usernames: the server holds who sent and who posted, and /privacy says those
 * are never published, so the shape it sends has nowhere to put them.
 */
export type RepoSource = {
  platform: "instagram" | "tiktok" | "x" | "reddit" | "facebook";
  postUrl: string;
  /**
   * Where in the post the repo was named. A plain string, not a union, because
   * the server's column has no CHECK constraint behind it and production
   * already holds values the schema never listed -- anything rendering this
   * tolerates one it has never heard of rather than printing `undefined`.
   */
  foundIn: string | null;
};

export type ListItem = {
  itemId: string;
  note: string | null;
  addedAt: string;
  addedByLogin: string | null;
  canRemove: boolean;
  repo: RepoSummary;
  /**
   * Owner and staff only; null for everyone else and for owner-posted repos.
   *
   * Optional, not just nullable: a deployment older than this field sends no
   * such key at all, and `request` casts the response rather than validating
   * it, so the type has to admit "absent" or the compiler lets a crash
   * through.
   */
  source?: RepoSource | null;
};

/** How a list's items can be ordered. The server sends the labels. */
export type ListSortOption = { key: string; label: string };

export type ListDetail = {
  list: Omit<ListSummary, "itemCount"> & {
    ownerLogin: string | null;
    isOwner: boolean;
    canAdd: boolean;
    views: number;
    visitors: number;
  };
  /** What the server actually applied, not what was asked for: `sort` comes
   *  back narrowed, and a query under `searchMin` comes back empty. */
  query?: string;
  sort?: string;
  items: ListItem[];
  limits: {
    maxItems: number;
    noteMax: number;
    /**
     * Everything below is optional because the app ships independently of the
     * server. `request` casts rather than validates, so a binary newer than
     * the deployment it talks to would read `sorts` as undefined and throw on
     * `.map` — the same trap that once rendered every card with no title.
     * Marking them optional is what makes the compiler demand the guard.
     *
     * `sorts` doubles as the capability flag: a server without it also ignores
     * `q` and `sort`, so the screen offers neither control rather than
     * offering two that do nothing.
     */
    searchMin?: number;
    sorts?: ListSortOption[];
  };
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

/**
 * One list, optionally filtered and reordered.
 *
 * Both options are omitted when the whole list in its curated order is wanted,
 * which is what every call did before searching existed and what `added` still
 * means. The server narrows an unknown sort rather than refusing it.
 */
export function getList(
  slug: string,
  opts: { q?: string; sort?: string } = {}
) {
  return request<ListDetail>(
    `/api/mobile/v1/lists/${slug}${qs({ q: opts.q, sort: opts.sort })}`
  );
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

/* ── Identify ─────────────────────────────────────────────────────────── */

/** One candidate the ladder produced, and what became of it. */
export type IdentifyAttempt = {
  fullName: string;
  source: string;
  via: "url" | "model-fast" | "model-deep" | "web-search";
  resolved: boolean;
  /** Dropped before GitHub was asked: the name appears nowhere in the post. */
  ungrounded?: boolean;
  /** Real, exists, and rejected by the verification rung as the wrong project. */
  unverified?: boolean;
};

export type IdentifyResult = {
  repo: {
    fullName: string;
    description: string | null;
    language: string | null;
    stars: number;
    archived: boolean;
    avatarUrl: string;
  } | null;
  foundIn: string | null;
  confidence: number;
  reasoning: string;
  attempts: IdentifyAttempt[];
  modelCalls: number;
  tokens: number;
  ms: number;
  /**
   * The model could not be reached, or this deployment has no key. Not an
   * error: rung one is a regex over literal github.com links and needs no
   * model, so the easy half still resolves. The screen has to say which --
   * "found nothing" and "the clever rungs did not run" are different answers
   * and must not be rendered as the same one.
   */
  degraded?: boolean;
  /**
   * The match came from web search, which measured wrong about a third of the
   * time. A suggestion for a human, not an answer, and the screen says so.
   */
  needsReview?: boolean;
};

/**
 * Identify which GitHub repository a post is about.
 *
 * Deliberately `/api/identify` rather than a route under `/api/mobile/v1`:
 * this endpoint is public, unauthenticated and spends real credits, and it
 * carries the per-visitor and global ceilings that keep a finite balance
 * alive. A second copy for the app would be a second set of counters -- i.e.
 * no ceiling at all. The app is one more visitor through the same door.
 *
 * Over the limit the server answers 429 with its own wording, which `request`
 * lifts onto the thrown ApiError; relaying that is the whole handling needed.
 */
export function identify(input: {
  caption?: string;
  stillsText?: string;
  transcript?: string;
}) {
  return request<IdentifyResult>("/api/identify", {
    method: "POST",
    body: JSON.stringify(input),
  });
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
