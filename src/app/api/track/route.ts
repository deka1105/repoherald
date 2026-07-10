import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { analyticsEvents } from "@/db/schema";
import {
  isAnalyticsEventType,
  isBot,
  isUuid,
  referrerHost,
  repoIdFromPath,
  visitorHash,
  type AnalyticsEventType,
} from "@/lib/analytics";

const NO_CONTENT = new Response(null, { status: 204 });

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NO_CONTENT;
  }
  if (typeof body !== "object" || body === null) return NO_CONTENT;
  const b = body as Record<string, unknown>;

  if (!isAnalyticsEventType(b.type)) return NO_CONTENT;

  const ua = req.headers.get("user-agent");
  if (isBot(ua)) return NO_CONTENT; // drop crawlers/monitors silently

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "0.0.0.0";

  let type: AnalyticsEventType = b.type;
  let path = typeof b.path === "string" ? b.path.slice(0, 512) : null;
  let repoId = isUuid(b.repoId) ? b.repoId : null;

  // A page view of /repos/{uuid} is a post open — record it as repo_view.
  const pathRepoId = repoIdFromPath(path);
  if (type === "page_view" && pathRepoId) {
    type = "repo_view";
    repoId = pathRepoId;
  }

  const session = await auth();
  const refHost = referrerHost(
    typeof b.referrer === "string" ? b.referrer : null,
    req.headers.get("host")
  );

  try {
    await db.insert(analyticsEvents).values({
      type,
      path,
      repoId,
      userId: session?.user?.id ?? null,
      visitorId: visitorHash(ip, ua as string),
      referrerHost: refHost,
      isAdmin: Boolean(session?.user?.isAdmin),
    });
  } catch {
    // swallow — never surface analytics failures to the client
  }

  return NO_CONTENT;
}
