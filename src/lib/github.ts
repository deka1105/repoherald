const GH = "https://api.github.com";

type GhInit = { token: string; accept?: string };

async function gh(path: string, { token, accept }: GhInit): Promise<Response> {
  return fetch(`${GH}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: accept ?? "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });
}

export class GithubAuthError extends Error {}
export class GithubRateLimitError extends Error {
  constructor(public retryAfterSeconds: number) {
    super("GitHub rate limited");
  }
}

function checkCommonErrors(res: Response) {
  if (res.status === 401) throw new GithubAuthError("GitHub token invalid");
  if (res.status === 403 || res.status === 429) {
    const retryAfter = Number(res.headers.get("retry-after") ?? "60");
    if (
      res.headers.get("x-ratelimit-remaining") === "0" ||
      res.headers.has("retry-after")
    ) {
      throw new GithubRateLimitError(retryAfter);
    }
  }
}

/** 204 = starred, 404 = not starred. */
export async function isStarred(
  token: string,
  ownerLogin: string,
  repoName: string
): Promise<boolean> {
  const res = await gh(`/user/starred/${ownerLogin}/${repoName}`, { token });
  if (res.status === 204) return true;
  if (res.status === 404) return false;
  checkCommonErrors(res);
  throw new Error(`GitHub star check failed: ${res.status}`);
}

/**
 * Finds when the user starred a repo, so pre-existing stars on newly listed
 * repos can be rejected. Pages the user's starred list (most recent first)
 * with the star+json media type; null if the star isn't found.
 */
export async function getStarredAt(
  token: string,
  githubRepoId: number,
  maxPages = 10
): Promise<Date | null> {
  for (let page = 1; page <= maxPages; page++) {
    const res = await gh(`/user/starred?per_page=100&page=${page}&sort=created&direction=desc`, {
      token,
      accept: "application/vnd.github.star+json",
    });
    checkCommonErrors(res);
    if (!res.ok) throw new Error(`GitHub starred list failed: ${res.status}`);
    const items: { starred_at: string; repo: { id: number } }[] = await res.json();
    const hit = items.find((s) => s.repo.id === githubRepoId);
    if (hit) return new Date(hit.starred_at);
    if (items.length < 100) break;
  }
  return null;
}

export type GithubRepo = {
  id: number;
  full_name: string;
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  archived: boolean;
  private: boolean;
  owner: { login: string; avatar_url: string; type: string };
};

export async function fetchRepoByFullName(
  token: string,
  ownerLogin: string,
  repoName: string
): Promise<GithubRepo | null> {
  const res = await gh(`/repos/${ownerLogin}/${repoName}`, { token });
  if (res.status === 404) return null;
  checkCommonErrors(res);
  if (!res.ok) throw new Error(`GitHub repo fetch failed: ${res.status}`);
  return res.json();
}

/** ID-based lookup survives renames/transfers. */
export async function fetchRepoById(
  token: string,
  githubRepoId: number
): Promise<GithubRepo | null> {
  const res = await gh(`/repositories/${githubRepoId}`, { token });
  if (res.status === 404) return null;
  checkCommonErrors(res);
  if (!res.ok) throw new Error(`GitHub repo fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchRepoLanguages(
  token: string,
  ownerLogin: string,
  repoName: string
): Promise<string[]> {
  const res = await gh(`/repos/${ownerLogin}/${repoName}/languages`, { token });
  checkCommonErrors(res);
  if (!res.ok) return [];
  const data: Record<string, number> = await res.json();
  return Object.keys(data);
}

export async function isOrgMember(token: string, orgLogin: string): Promise<boolean> {
  const res = await gh(`/user/memberships/orgs/${orgLogin}`, { token });
  if (!res.ok) return false;
  const body: { state?: string } = await res.json();
  return body.state === "active";
}

export type GithubIssue = {
  id: number;
  number: number;
  htmlUrl: string;
  authorLogin: string;
  labels: string[];
  state: "open" | "closed";
  stateReason: string | null;
  isPullRequest: boolean;
  createdAt: Date;
};

/** Reads one issue. Returns null when it is gone (404) — deleted or the repo
 * went private — which the validator treats as a rejection, not an error. */
export async function fetchIssue(
  token: string,
  ownerLogin: string,
  repoName: string,
  issueNumber: number
): Promise<GithubIssue | null> {
  const res = await gh(`/repos/${ownerLogin}/${repoName}/issues/${issueNumber}`, {
    token,
  });
  if (res.status === 404 || res.status === 410) return null;
  checkCommonErrors(res);
  if (!res.ok) throw new Error(`GitHub issue fetch failed: ${res.status}`);
  const b: {
    id: number;
    number: number;
    html_url: string;
    user: { login: string } | null;
    labels: (string | { name?: string })[];
    state: "open" | "closed";
    state_reason: string | null;
    pull_request?: unknown;
    created_at: string;
  } = await res.json();
  return {
    id: b.id,
    number: b.number,
    htmlUrl: b.html_url,
    authorLogin: b.user?.login ?? "",
    labels: (b.labels ?? []).map((l) => (typeof l === "string" ? l : l.name ?? "")),
    state: b.state,
    stateReason: b.state_reason,
    // The issues endpoint also returns pull requests; they are not bug reports.
    isPullRequest: Boolean(b.pull_request),
    createdAt: new Date(b.created_at),
  };
}
