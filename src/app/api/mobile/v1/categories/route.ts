import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { ok } from "@/lib/mobile-api";

export const dynamic = "force-dynamic";

/** The category options behind the Post a repo form. Public: they are the same
 *  labels already rendered on every listing. */
export async function GET() {
  const rows = await db
    .select({
      id: categories.id,
      kind: categories.kind,
      slug: categories.slug,
      label: categories.label,
    })
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(asc(categories.kind), asc(categories.label));

  return ok({
    useCases: rows.filter((r) => r.kind === "use_case"),
    sectors: rows.filter((r) => r.kind === "sector"),
  });
}
