import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { reports, repos } from "@/db/schema";
import { userIdFrom } from "@/lib/mobile-auth";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * File a moderation report against a listing, from the iOS/Android app.
 *
 * Deliberately works signed OUT, unlike the web's `reportRepo`. App Store
 * Guideline 1.2 requires a way to report objectionable content in any app that
 * displays user-submitted content, and gating that behind sign-in would mean
 * the people most likely to encounter something — anyone browsing, since the
 * feed needs no account — have no way to flag it. `reports.reporter_user_id`
 * is already nullable, so an anonymous report is a first-class row rather than
 * a special case.
 *
 * The reason is a closed set, not free text. A text field here would be a new
 * place for a stranger to write anything into our database, and moderators
 * only ever act on the category.
 */
const REASONS = ["spam", "malware", "offensive", "misleading", "other"] as const;
type Reason = (typeof REASONS)[number];

function isReason(v: unknown): v is Reason {
  return typeof v === "string" && (REASONS as readonly string[]).includes(v);
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed body" }, { status: 400 });
  }

  const { repoId, reason } = (body ?? {}) as { repoId?: unknown; reason?: unknown };

  if (typeof repoId !== "string" || !repoId) {
    return NextResponse.json({ error: "repoId is required" }, { status: 400 });
  }
  if (!isReason(reason)) {
    return NextResponse.json(
      { error: `reason must be one of: ${REASONS.join(", ")}` },
      { status: 400 }
    );
  }

  // A report against a listing that does not exist is a client bug or a probe;
  // either way it should not create a row a moderator has to triage.
  const [repo] = await db.select({ id: repos.id }).from(repos).where(eq(repos.id, repoId)).limit(1);
  if (!repo) {
    return NextResponse.json({ error: "Repo not found" }, { status: 404 });
  }

  // May be null: see the note above.
  const reporterUserId = userIdFrom(req);

  // One open report per person per listing. Tapping Report twice is a normal
  // thing to do on a phone and must not deal a moderator two identical rows.
  // Anonymous reports cannot be deduped this way and are accepted as-is; that
  // is the cost of not requiring an account to flag something.
  if (reporterUserId) {
    const [existing] = await db
      .select({ id: reports.id })
      .from(reports)
      .where(
        and(
          eq(reports.repoId, repoId),
          eq(reports.reporterUserId, reporterUserId),
          eq(reports.status, "open")
        )
      )
      .limit(1);

    if (existing) {
      return NextResponse.json({ reported: true, deduped: true });
    }
  }

  await db.insert(reports).values({
    repoId,
    reporterUserId,
    reason,
  });

  await writeAudit(db, {
    actorUserId: reporterUserId,
    actorType: "user",
    action: "listing.report",
    entityType: "repo",
    entityId: repoId,
    metadata: { source: "mobile", reason, anonymous: reporterUserId === null },
  });

  return NextResponse.json({ reported: true });
}
