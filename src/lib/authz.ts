import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });
  if (!user) throw new Error("User not found");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") throw new Error("Not authorized");
  return user;
}

/** Moderator-or-above: content/community tools. Money, credits, roles, and
 * pricing must keep using requireAdmin. */
export async function requireModerator() {
  const user = await requireUser();
  if (user.role !== "admin" && user.role !== "moderator") {
    throw new Error("Not authorized");
  }
  return user;
}
