import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { repos } from "@/db/schema";
import { getActivePlans } from "@/lib/pricing";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PromoteForm } from "./promote-form";

export const metadata = { title: "Sponsor a listing — repoherald" };

export default async function PromotePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");
  const { status } = await searchParams;

  const [ownRepos, plans] = await Promise.all([
    db
      .select({ id: repos.id, fullName: repos.fullName })
      .from(repos)
      .where(eq(repos.postedByUserId, session.user.id)),
    getActivePlans(),
  ]);

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-xl flex-1 space-y-4 px-4 py-6 pb-24 md:pb-14">
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
            <CardTitle className="text-base">Choose a repo and plan</CardTitle>
          </CardHeader>
          <CardContent>
            {ownRepos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Post a repo first — you can only sponsor your own listings.
              </p>
            ) : plans.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sponsorship plans aren&apos;t available right now — check back soon.
              </p>
            ) : (
              <PromoteForm
                repos={ownRepos}
                plans={plans.map((p) => ({
                  key: p.key,
                  label: p.label,
                  amountCents: p.amountCents,
                  discountPercent: p.discountPercent,
                  currency: p.currency,
                }))}
              />
            )}
          </CardContent>
        </Card>
        <Link
          href="/"
          className="inline-block text-sm text-muted-foreground hover:underline"
        >
          ← Back to feed
        </Link>
      </main>
    </>
  );
}
