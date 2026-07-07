import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { repos } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SponsorForm } from "./sponsor-form";

export default async function SponsorPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");
  const { status } = await searchParams;

  const ownRepos = await db
    .select({ id: repos.id, fullName: repos.fullName })
    .from(repos)
    .where(eq(repos.postedByUserId, session.user.id));

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">Sponsor a listing</h1>
      <p className="text-sm text-muted-foreground">
        Sponsored repos are pinned to the top of the feed (or featured within it)
        for the duration you choose.
      </p>
      {status === "success" && (
        <p className="rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          Payment received — your sponsorship is live.
        </p>
      )}
      {status === "cancelled" && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          Checkout cancelled — no charge was made.
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Choose a repo and duration</CardTitle>
        </CardHeader>
        <CardContent>
          {ownRepos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Post a repo first — you can only sponsor your own listings.
            </p>
          ) : (
            <SponsorForm repos={ownRepos} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
