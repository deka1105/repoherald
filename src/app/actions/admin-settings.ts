"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireAdmin } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { setFlag, type FlagName } from "@/lib/settings";
import {
  AUTO_POST_ENABLED_ACTION,
  autoPostPendingCandidates,
  type SweepResult,
} from "@/lib/ingest-post";

// Admin, not moderator: these are site-wide switches. One of them decides
// whether repos reach the public feed without anybody reading them, and the
// other takes a paid product off sale.
async function flip(name: FlagName, on: boolean, action: string) {
  const actor = await requireAdmin();
  await setFlag(name, on);
  await writeAudit(db, {
    actorUserId: actor.id,
    actorType: "admin",
    action,
    entityType: "app_setting",
    entityId: name,
    metadata: { on },
  });
  return actor;
}

/**
 * Turning this ON posts everything already waiting, under the admin who
 * pressed it — which is the whole point of the switch, and is stated on the
 * button. The audit row is written FIRST because autoPostPendingCandidates()
 * reads it back to decide whose name goes on the listings.
 */
export async function setIngestAutoPost(formData: FormData) {
  const on = String(formData.get("on") ?? "") === "1";
  await flip(
    "ingestAutoPost",
    on,
    on ? AUTO_POST_ENABLED_ACTION : "settings.ingest_auto_post.off"
  );

  let swept: SweepResult | null = null;
  if (on) swept = await autoPostPendingCandidates();

  revalidatePath("/admin/settings");
  revalidatePath("/admin/ingest");
  if (swept?.posted) revalidatePath("/");
}

export async function setSponsorshipsEnabled(formData: FormData) {
  const on = String(formData.get("on") ?? "") === "1";
  await flip(
    "sponsorshipsEnabled",
    on,
    on ? "settings.sponsorships.on" : "settings.sponsorships.off"
  );
  // The flag changes the chrome on every page, so the whole site is stale.
  revalidatePath("/", "layout");
}

/** Post what is waiting now, rather than at the next nightly run. */
export async function runIngestSweep() {
  await requireAdmin();
  const swept = await autoPostPendingCandidates();
  revalidatePath("/admin/settings");
  revalidatePath("/admin/ingest");
  if (swept.posted) revalidatePath("/");
}
