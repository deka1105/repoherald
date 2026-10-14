import { desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { ingestRepoCandidates, ingestSightings } from "@/db/schema";
import { approveCandidate, rejectCandidate } from "@/app/actions/ingest";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { candidateOwner } from "@/lib/ingest-post";
import { timeAgo } from "@/lib/utils";

// Repos that arrived from somewhere other than their owner — currently
// Instagram DMs, mined by repoHeraldIG.
//
// Nothing here reaches the feed at all. Approving files a repo into the PRIVATE
// list of whoever sent it — matched from the sighting's sender handle to the
// account that has claimed it. A candidate whose sender nobody has claimed has
// no destination, so its button is disabled and it waits in the queue.
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

  // 'approved' is a leftover state from when approving and posting were two
  // buttons. Those rows are still waiting to go on the feed, so they count as
  // awaiting review rather than done.
  const waiting = candidates.filter(
    (c) => c.status !== "promoted" && c.status !== "rejected"
  ).length;

  // Resolved per candidate so the queue can name the destination rather than
  // greying out a button with no explanation.
  const owners = new Map(
    await Promise.all(
      candidates.map(async (c) => [c.id, await candidateOwner(c)] as const)
    )
  );
  const ownerless = candidates.filter(
    (c) =>
      c.status !== "promoted" &&
      c.status !== "rejected" &&
      !owners.get(c.id)?.userId
  ).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {waiting} awaiting review. <strong>Approve</strong> files the repo into the
        private list of the account that sent it. Nothing here reaches the feed.
        {ownerless > 0 && (
          <>
            {" "}
            {ownerless} of them {ownerless === 1 ? "has" : "have"} no claimed sender
            and {ownerless === 1 ? "is" : "are"} waiting for one.
          </>
        )}
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
                  {c.status !== "rejected" && (
                    <p className="mt-1 text-xs">
                      {owners.get(c.id)?.userId ? (
                        <span className="text-muted-foreground">
                          files into @{owners.get(c.id)?.senders[0]}&apos;s private{" "}
                          {c.platform} list
                        </span>
                      ) : (
                        <span className="text-destructive">
                          {owners.get(c.id)?.senders.length
                            ? `no account has claimed @${owners.get(c.id)?.senders[0]} yet`
                            : "sender unknown, so there is nobody to file this for"}
                        </span>
                      )}
                    </p>
                  )}
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
                    {c.status === "promoted" ? "posted" : c.status}
                  </Badge>
                  {c.status !== "promoted" && c.status !== "rejected" && (
                    <>
                      <form action={approveCandidate}>
                        <input type="hidden" name="id" value={c.id} />
                        <Button
                          type="submit"
                          size="sm"
                          disabled={c.githubRepoId == null || !owners.get(c.id)?.userId}
                        >
                          Approve &amp; file
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
