import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { userIdFrom } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

/** The signed-in user and their credit balance. */
export async function GET(req: Request) {
  const userId = userIdFrom(req);
  if (!userId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const [row] = await db
    .select({
      id: users.id,
      githubLogin: users.githubLogin,
      name: users.name,
      avatarUrl: users.avatarUrl,
      creditBalance: users.creditBalance,
      mintEligible: users.mintEligible,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // A valid signature for a user who no longer exists — deleted account, or a
  // token minted against a different database. Treat as unauthenticated.
  if (!row) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  return NextResponse.json({ version: 1, user: row });
}
