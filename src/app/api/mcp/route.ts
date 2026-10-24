/**
 * The repoherald MCP server.
 *
 * Model Context Protocol endpoint, so an assistant can query the catalogue
 * mid-conversation instead of the user tabbing to the site and pasting results
 * back. Mounted at /api/mcp; clients are given that full URL.
 *
 * Read-only and unauthenticated, deliberately. Everything exposed here is
 * already public on the web and already served unauthenticated by
 * `/api/mobile/v1/feed` and `/search`, so there is no new surface — the same
 * rows, a different envelope. Anything that writes, or that reads a particular
 * person's lists, needs the OAuth flow in the MCP spec and is not in this file.
 *
 * The tools call `src/lib/*` directly rather than fetching our own HTTP routes.
 * A self-request would cost a second function invocation and a TLS handshake to
 * reach code already loaded in this process, and would make the MCP server's
 * behaviour depend on the public API staying reachable from inside the VPC.
 *
 * Output is prose, not JSON. The consumer is a language model: `tokio-rs/axum
 * — Rust — ★21400` costs a fraction of the tokens of the equivalent object and
 * needs no explanation. Every repo line carries its `id` because that is the
 * argument `get_repo` takes, and a result the model cannot follow up on is a
 * dead end.
 */
import { and, asc, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { createMcpHandler } from "mcp-handler";
import { db } from "@/db";
import { categories, repoCategories, repos, users } from "@/db/schema";
import { getFeed, type FeedFilters, type FeedRepo } from "@/lib/feed";
import { searchRepos } from "@/lib/search";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SITE = "https://repoherald.com";

/**
 * `getFeed` caches itself. These two do not, and an unauthenticated endpoint
 * an agent can call in a loop is the wrong place to run an uncached ILIKE.
 * Same mechanism the feed uses, and the same reason it isn't "use cache":
 * Cache Components is off, and enabling it is an app-wide decision.
 *
 * Five minutes. The catalogue changes when somebody posts a repo, which is
 * rare enough that a stale search result is not a thing anyone will notice.
 */
const CACHE_SECONDS = 300;

const searchCached = unstable_cache(
  (query: string) => searchRepos(query, null),
  ["mcp-search"],
  { revalidate: CACHE_SECONDS, tags: ["repos"] }
);

const repoDetailCached = unstable_cache(
  async (id: string) => {
    const repo = await db.query.repos.findFirst({ where: eq(repos.id, id) });
    // `removed` is a moderation decision and must not be readable here, the
    // same rule the mobile route applies. `hidden` is excluded too: it means
    // the listing is reachable only by someone holding its link, and an
    // unauthenticated tool is not that someone.
    if (!repo || repo.status !== "active") return null;

    const [poster, cats] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, repo.postedByUserId) }),
      db
        .select({ label: categories.label, kind: categories.kind })
        .from(repoCategories)
        .innerJoin(categories, eq(repoCategories.categoryId, categories.id))
        .where(eq(repoCategories.repoId, repo.id)),
    ]);

    // `createdAt` is a Date here but a string on a cache hit, because
    // unstable_cache round-trips through JSON. Normalise before it leaves.
    return {
      repo: { ...repo, createdAt: repo.createdAt.toISOString() },
      posterLogin: poster?.githubLogin ?? null,
      cats,
    };
  },
  ["mcp-repo"],
  { revalidate: CACHE_SECONDS, tags: ["repos"] }
);

/** Trimmed so one repo is one line plus its blurb, not a wall. */
function line(r: {
  id: string;
  fullName: string;
  description: string | null;
  primaryLanguage: string | null;
  starsCount: number;
  isArchived: boolean;
}): string {
  const facts = [r.primaryLanguage, `★${r.starsCount.toLocaleString("en-US")}`]
    .filter(Boolean)
    .join(" — ");
  return [
    `${r.fullName} — ${facts}${r.isArchived ? " — ARCHIVED" : ""}`,
    r.description ? `  ${r.description}` : null,
    `  id: ${r.id} · ${SITE}/repo/${r.id} · https://github.com/${r.fullName}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function feedLine(r: FeedRepo): string {
  const tags = r.categoryLabels.length ? `\n  tags: ${r.categoryLabels.join(", ")}` : "";
  return line(r) + tags;
}

const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "search_repos",
      {
        title: "Search repoherald",
        description:
          "Full-text search over every repository posted to repoherald, matching " +
          "name, owner and description. Use this when the user names a specific " +
          "project or types a keyword. For open-ended discovery ('a good Rust web " +
          "framework') prefer browse_feed with filters, which ranks by community " +
          "signal rather than string match.",
        inputSchema: z.object({
          query: z
            .string()
            .min(2, "at least two characters")
            .describe("Search text, e.g. 'axum' or 'vector database'"),
        }),
      },
      async ({ query }) => {
        // null userId inside searchCached: the private half of search reads the
        // caller's own lists, and this server has no caller. Public listings
        // only — which is also what makes the result safe to share in a cache.
        const hits = await searchCached(query);
        if (!hits.length) {
          return text(
            `No repositories on repoherald match "${query}".\n\n` +
              `The catalogue is human-curated and far smaller than GitHub's, so ` +
              `a miss here means nobody has posted it — not that it doesn't exist.`
          );
        }
        return text(
          `${hits.length} result${hits.length === 1 ? "" : "s"} for "${query}":\n\n` +
            hits.map((h) => line(h.repo)).join("\n\n")
        );
      }
    );

    server.registerTool(
      "browse_feed",
      {
        title: "Browse repoherald",
        description:
          "The ranked repoherald feed, optionally narrowed by language, use case " +
          "or sector. This is the tool for discovery: it answers 'what are good " +
          "options for X' in a way GitHub search cannot, because the catalogue is " +
          "posted and categorised by people. Call list_categories first to get " +
          "valid useCase and sector slugs — a wrong slug silently returns nothing.",
        inputSchema: z.object({
          language: z
            .string()
            .optional()
            .describe("Exact language name as GitHub reports it, e.g. 'TypeScript'"),
          useCase: z.string().optional().describe("Use-case slug from list_categories"),
          sector: z.string().optional().describe("Sector slug from list_categories"),
          query: z.string().optional().describe("Extra text filter applied to the feed"),
          cursor: z
            .string()
            .optional()
            .describe("nextCursor from a previous call, to page further"),
        }),
      },
      async ({ language, useCase, sector, query, cursor }) => {
        const filters: FeedFilters = {};
        if (language) filters.language = language;
        if (useCase) filters.useCase = useCase;
        if (sector) filters.sector = sector;
        if (query) filters.q = query;

        const { items, pinned, nextCursor } = await getFeed({ cursor, filters });
        // Pinned entries are sponsored placements. They are merged into the list
        // the website renders, so leaving them out here would mean the tool and
        // the site disagree about what is on the feed.
        const all = [...pinned, ...items];

        if (!all.length) {
          const applied = Object.entries(filters)
            .map(([k, v]) => `${k}=${v}`)
            .join(", ");
          // "No results" has two very different causes, and saying the wrong one
          // sends the model down the wrong path: a slug that doesn't exist is a
          // mistake to correct, an empty category is a fact to report. Check
          // which it was rather than guessing in the copy.
          const unknown = (
            await Promise.all(
              ([
                ["useCase", "use_case", useCase],
                ["sector", "sector", sector],
              ] as const).map(async ([arg, kind, slug]) => {
                if (!slug) return null;
                const hit = await db.query.categories.findFirst({
                  where: and(eq(categories.kind, kind), eq(categories.slug, slug)),
                });
                return hit ? null : `${arg}="${slug}"`;
              })
            )
          ).filter((s): s is string => s !== null);

          return text(
            `No repositories match${applied ? ` (${applied})` : ""}.\n\n` +
              (unknown.length
                ? `${unknown.join(" and ")} ${
                    unknown.length > 1 ? "are not known slugs" : "is not a known slug"
                  } — call list_categories for the valid set.`
                : `Those filters are valid; the catalogue simply has nothing ` +
                  `under them yet. Widening or dropping a filter will help more ` +
                  `than rewording it.`)
          );
        }

        return text(
          `${all.length} repositor${all.length === 1 ? "y" : "ies"}:\n\n` +
            all.map(feedLine).join("\n\n") +
            (nextCursor ? `\n\nMore available — pass cursor: ${nextCursor}` : "")
        );
      }
    );

    server.registerTool(
      "get_repo",
      {
        title: "Repository detail",
        description:
          "Full detail for one repository: description, language list, categories, " +
          "who posted it and when. Takes the id printed by search_repos or " +
          "browse_feed.",
        inputSchema: z.object({
          id: z.string().uuid().describe("Repository id from a search or feed result"),
        }),
      },
      async ({ id }) => {
        const found = await repoDetailCached(id);
        if (!found) return text(`No active repository with id ${id}.`);
        const { repo, posterLogin, cats } = found;

        const useCases = cats.filter((c) => c.kind === "use_case").map((c) => c.label);
        const sectors = cats.filter((c) => c.kind === "sector").map((c) => c.label);

        return text(
          [
            repo.fullName,
            repo.description ?? "(no description)",
            "",
            `Language:  ${repo.primaryLanguage ?? "unknown"}`,
            repo.languages.length ? `Languages: ${repo.languages.join(", ")}` : null,
            `Stars:     ${repo.starsCount.toLocaleString("en-US")}`,
            repo.isArchived ? "Archived:  yes" : null,
            useCases.length ? `Use cases: ${useCases.join(", ")}` : null,
            sectors.length ? `Sectors:   ${sectors.join(", ")}` : null,
            `Posted:    ${repo.createdAt.slice(0, 10)}${
              posterLogin ? ` by ${posterLogin}` : ""
            }`,
            "",
            `${SITE}/repo/${repo.id}`,
            `https://github.com/${repo.fullName}`,
          ]
            .filter((l) => l !== null)
            .join("\n")
        );
      }
    );

    server.registerTool(
      "list_categories",
      {
        title: "Category vocabulary",
        description:
          "The use-case and sector slugs browse_feed accepts, with their labels. " +
          "Call this before filtering: the slugs are repoherald's own vocabulary " +
          "and cannot be guessed reliably.",
        inputSchema: z.object({}),
      },
      async () => {
        const rows = await db
          .select({ kind: categories.kind, slug: categories.slug, label: categories.label })
          .from(categories)
          .where(eq(categories.isActive, true))
          .orderBy(asc(categories.kind), asc(categories.label));

        const fmt = (kind: "use_case" | "sector") =>
          rows
            .filter((r) => r.kind === kind)
            .map((r) => `  ${r.slug} — ${r.label}`)
            .join("\n") || "  (none)";

        return text(
          `Use cases (pass as useCase):\n${fmt("use_case")}\n\n` +
            `Sectors (pass as sector):\n${fmt("sector")}`
        );
      }
    );
  },
  {
    serverInfo: { name: "repoherald", version: "1.0.0" },
    instructions:
      "repoherald is a human-curated catalogue of GitHub repositories, " +
      "categorised by use case and sector. It is much smaller than GitHub and " +
      "deliberately so: every entry was posted by a person. Use it when the " +
      "user wants a recommendation or wants to know what others are using, not " +
      "as a general GitHub index.",
  }
);

/**
 * A speed bump, not a wall.
 *
 * Each serverless instance keeps its own counter, so the real ceiling is this
 * number times however many instances are warm — which makes it useless against
 * a distributed flood and effective against the thing that will actually
 * happen: one client, or one agent in a retry loop, calling in a tight circle.
 * A wall belongs at the edge (Vercel Firewall), where it can be enforced once
 * rather than per instance, and where it costs no function invocation.
 *
 * Paired with the caches above this is enough that a hot caller mostly hits
 * memory rather than Neon.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;
/** Bounded so a spray of unique IPs cannot grow the map without limit. */
const MAX_TRACKED = 10_000;

const seen = new Map<string, { count: number; resetAt: number }>();

function overLimit(req: Request): number | null {
  const now = Date.now();

  // Pruning here rather than on a timer: there is no process to own a timer on
  // a serverless instance, and an expired entry costs nothing until it's read.
  if (seen.size > MAX_TRACKED) {
    for (const [k, v] of seen) if (v.resetAt <= now) seen.delete(k);
    // Still oversized means the window is full of live callers, not garbage.
    // Drop everything rather than grow: the cost is one forgiven window.
    if (seen.size > MAX_TRACKED) seen.clear();
  }

  // Vercel sets x-forwarded-for; the left-most entry is the client. Absent it,
  // everyone shares one bucket, which fails closed rather than open.
  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();

  const entry = seen.get(ip);
  if (!entry || entry.resetAt <= now) {
    seen.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW ? Math.ceil((entry.resetAt - now) / 1000) : null;
}

async function guarded(req: Request): Promise<Response> {
  const retryAfter = overLimit(req);
  if (retryAfter !== null) {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32029, message: `Rate limited. Retry in ${retryAfter}s.` },
        id: null,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
        },
      }
    );
  }
  return handler(req);
}

export { guarded as GET, guarded as POST };
