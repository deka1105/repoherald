import { desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { ingestRepoCandidates, ingestSightings } from "@/db/schema";
import {
  approveCandidate,
  promoteCandidate,
  rejectCandidate,
} from "@/app/actions/ingest";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/utils";

// Repos that arrived from somewhere other than their owner — currently
// Instagram DMs, mined by repoHeraldIG.
//
// Nothing here is on the feed. `repos.postedByUserId` is NOT NULL and the rule
// is that you may only post a repo you own, so a repo a stranger sent us has
// no legitimate poster until a moderator takes it on. "Promote" is that act,
// and it writes the moderator as the posting user.
//
// Sender and poster usernames are shown HERE and nowhere else. They are how a
// reviewer sees that one account is pushing the same repo five times; they are
// not the site's business to publish, and /privacy says so.
export default async function AdminIngestPage() {
  const candidates = await db
    .select()
    .from(ingestRepoCandidates)
    .orderBy(desc(ingestRepoCandidates.discoveredAt))
    .limit(200);

  const sightings = candidates.length
    ? await db
        .select()
        .from(ingestSightings)
        .where(
          inArray(
            ingestSightings.candidateId,
            candidates.map((c) => c.id)
          )
        )
        .orderBy(desc(ingestSightings.createdAt))
    : [];

  const byCandidate = new Map<string, typeof sightings>();
  for (const s of sightings) {
    const list = byCandidate.get(s.candidateId) ?? [];
    list.push(s);
    byCandidate.set(s.candidateId, list);
  }

  const pending = candidates.filter((c) => c.status === "pending").length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {pending} awaiting review. Approving records that a human looked; it does not list
        anything. <strong>Promote</strong> puts the repo on the feed under your name — you
        become its poster, and the audit log records that.
      </p>

      {candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing discovered yet. repoHeraldIG writes here when it finds a repository shared
          in a direct message.
        </p>
      ) : (
        candidates.map((c) => {
          const seen = byCandidate.get(c.id) ?? [];
          return (
            <div key={c.id} className="space-y-3 rounded-md border p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                {/* basis-64 rather than flex-1's basis-0: the row stays on one
                   line at any desktop width regardless of description length,
                   and still wraps the buttons underneath on a narrow screen. */}
                <div className="min-w-0 flex-1 basis-64">
                  <p className="text-sm">
                    <a
                      href={`https://github.com/${c.fullName}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium underline underline-offset-2"
                    >
                      {c.fullName}
                    </a>{" "}
                    <span className="text-muted-foreground">
                      {c.starsCount.toLocaleString()}★
                      {c.primaryLanguage ? ` · ${c.primaryLanguage}` : ""}
                      {c.isArchived ? " · archived" : ""}
                    </span>
                  </p>
                  {c.description && (
                    <p className="mt-1 text-xs text-muted-foreground">{c.description}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    via {c.platform} · found {timeAgo(c.discoveredAt)}
                    {c.githubRepoId == null && " · repo id unresolved"}
                    {c.reviewNote ? ` · “${c.reviewNote}”` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge
                    variant={
                      c.status === "promoted"
                        ? "default"
                        : c.status === "rejected"
                          ? "outline"
                          : "secondary"
                    }
                  >
                    {c.status}
                  </Badge>
                  {c.status !== "promoted" && c.status !== "rejected" && (
                    <>
                      {c.status === "pending" && (
                        <form action={approveCandidate}>
                          <input type="hidden" name="id" value={c.id} />
                          <Button type="submit" size="sm" variant="secondary">
                            Approve
                          </Button>
                        </form>
                      )}
                      <form action={promoteCandidate}>
                        <input type="hidden" name="id" value={c.id} />
                        <Button type="submit" size="sm" disabled={c.githubRepoId == null}>
                          Promote
                        </Button>
                      </form>
                      <form action={rejectCandidate}>
                        <input type="hidden" name="id" value={c.id} />
                        <Button type="submit" size="sm" variant="destructive">
                          Reject
                        </Button>
                      </form>
                    </>
                  )}
                </div>
              </div>

              {seen.length > 0 && (
                <ul className="space-y-1 border-t pt-2 text-xs text-muted-foreground">
                  {seen.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-baseline gap-x-2">
                      <a
                        href={s.postUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2"
                      >
                        {s.shortcode ?? "post"}
                      </a>
                      <span>
                        from {s.senderUsername ? `@${s.senderUsername}` : "unknown sender"}
                        {s.posterUsername && ` · posted by @${s.posterUsername}`}
                        {s.foundIn && ` · found in ${s.foundIn}`}
                      </span>
                      {s.messageTs && <span>· {timeAgo(s.messageTs)}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
