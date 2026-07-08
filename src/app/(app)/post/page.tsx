import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { PostRepoForm } from "./post-form";

export default async function PostPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const cats = await db
    .select()
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(asc(categories.label));

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-xl font-semibold">Post a repo</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        List a public GitHub repo you own (or belong to via an org) so others can
        discover and star it.
      </p>
      <PostRepoForm
        useCases={cats.filter((c) => c.kind === "use_case")}
        sectors={cats.filter((c) => c.kind === "sector")}
      />
    </div>
  );
}
