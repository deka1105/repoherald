import { and, count, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { ingestRepoCandidates, sponsorships } from "@/db/schema";
import {
  runIngestSweep,
  setIngestAutoPost,
  setSponsorshipsEnabled,
} from "@/app/actions/admin-settings";
import { autoPostActor } from "@/lib/ingest-post";
import { getFlags } from "@/lib/settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function Toggle({
  on,
  action,
  label,
}: {
  on: boolean;
  action: (formData: FormData) => Promise<void>;
  label: string;
}) {
  return (
    <form action={action} className="shrink-0">
      <input type="hidden" name="on" value={on ? "0" : "1"} />
      <Button type="submit" size="sm" variant={on ? "destructive" : "default"}>
        {on ? "Turn off" : label}
      </Button>
    </form>
  );
}

export default async function AdminSettingsPage() {
  const flags = await getFlags();

  const [waitingRow] = await db
    .select({ n: count() })
    .from(ingestRepoCandidates)
    .where(inArray(ingestRepoCandidates.status, ["pending", "approved"]));
  const waiting = waitingRow?.n ?? 0;

  // "Live" means paid for AND still inside its window — an 'active' row whose
  // ends_at has passed is just one the expiry job has not swept yet, and
  // warning about it would cry wolf.
  const [liveRow] = await db
    .select({ n: count() })
    .from(sponsorships)
    .where(
      and(eq(sponsorships.status, "active"), gt(sponsorships.endsAt, sql`now()`))
    );
  const liveSponsorships = liveRow?.n ?? 0;

  const actor = flags.ingestAutoPost ? await autoPostActor() : null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Site-wide switches. They take effect within 30 seconds everywhere, and every
        flip is written to the audit log.
      </p>

      {/* ── Ingest auto-post ─────────────────────────────────────────────── */}
      <div className="space-y-3 rounded-md border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 basis-64">
            <h2 className="text-sm font-medium">
              Auto-approve and post repos from repoHeraldIG
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              On, repos found in Instagram DMs skip the review queue and go straight to
              the feed under your name. Nobody reads them first — including you.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant={flags.ingestAutoPost ? "default" : "secondary"}>
              {flags.ingestAutoPost ? "on" : "off"}
            </Badge>
            <Toggle
              on={flags.ingestAutoPost}
              action={setIngestAutoPost}
              label={waiting > 0 ? `Turn on & post ${waiting}` : "Turn on"}
            />
          </div>
        </div>

        <div className="border-t pt-3 text-xs text-muted-foreground">
          {flags.ingestAutoPost ? (
            <>
              <p>
                Listed as{" "}
                {actor ? (
                  <strong>@{actor.login}</strong>
                ) : (
                  <strong className="text-destructive">
                    nobody — posting is halted
                  </strong>
                )}
                . `app_settings` stores integers, so the owner is read back from the
                audit entry for the last time this was switched on. If that admin is
                gone or demoted, the sweep stops rather than guessing.
              </p>
              <p className="mt-1">
                New arrivals are posted by the nightly job at 03:00 UTC. {waiting} waiting
                now.
              </p>
            </>
          ) : (
            <p>
              Off: repos wait in <strong>Ingest</strong> until a moderator approves them.
              {waiting > 0 && ` ${waiting} waiting.`}
            </p>
          )}
        </div>

        {flags.ingestAutoPost && waiting > 0 && (
          <form action={runIngestSweep}>
            <Button type="submit" size="sm" variant="secondary">
              Post {waiting} waiting now
            </Button>
          </form>
        )}
      </div>

      {/* ── Sponsorships ─────────────────────────────────────────────────── */}
      <div className="space-y-3 rounded-md border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 basis-64">
            <h2 className="text-sm font-medium">Sponsorships</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Off, every way in disappears: the landing popup and its nav and footer
              buttons, the Sponsor link in the header and mobile bar, and the discount
              prompt. <code>/promote</code> redirects home, and no sponsored placement is
              injected into the feed.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant={flags.sponsorshipsEnabled ? "default" : "secondary"}>
              {flags.sponsorshipsEnabled ? "on sale" : "withdrawn"}
            </Badge>
            <Toggle
              on={flags.sponsorshipsEnabled}
              action={setSponsorshipsEnabled}
              label="Turn on"
            />
          </div>
        </div>

        <div className="border-t pt-3 text-xs text-muted-foreground">
          <p>
            This hides the product; it does not cancel anything. Stripe keeps working for
            payments already in flight, and existing rows stay in{" "}
            <strong>Sponsorships</strong>.
          </p>
          {liveSponsorships > 0 ? (
            <p className="mt-1 text-destructive">
              {liveSponsorships} sponsorship{liveSponsorships === 1 ? " is" : "s are"}{" "}
              live and paid for. Turning this off removes the placement they bought
              without refunding it — cancel and refund those first.
            </p>
          ) : (
            <p className="mt-1">
              No sponsorship is currently live, so nothing paid for is affected.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
