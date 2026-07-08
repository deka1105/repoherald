import { sql } from "drizzle-orm";
import { Users } from "lucide-react";
import { db } from "@/db";
import { users } from "@/db/schema";

export async function UserCount() {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users);

  return (
    <div className="fixed bottom-3 left-3 z-40 hidden items-center gap-1.5 rounded-full border bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur md:flex">
      <Users className="size-3.5" />
      {count.toLocaleString()} {count === 1 ? "user" : "users"}
    </div>
  );
}
