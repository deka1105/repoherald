import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getActiveCreditPacks } from "@/lib/pricing";
import { Header } from "@/components/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BuyCreditsForm } from "./buy-credits-form";

export const metadata = { title: "Buy credits — repoherald" };

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");
  const { status } = await searchParams;

  const packs = await getActiveCreditPacks();

  return (
    <>
      <Header />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-6 pb-24 md:pb-14">
        <h1 className="text-xl font-semibold">Buy credits</h1>
        <p className="text-sm text-muted-foreground">
          1 credit = 1 hour highlighting your own repo, or 15 minutes donated to
          any repo. Credits land in your wallet as soon as payment completes.
        </p>
        {status === "cancelled" && (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            Checkout cancelled — no charge was made.
          </p>
        )}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pick a pack</CardTitle>
          </CardHeader>
          <CardContent>
            {packs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Credit packs aren&apos;t available right now — check back soon.
              </p>
            ) : (
              <BuyCreditsForm
                packs={packs.map((p) => ({
                  key: p.key,
                  label: p.label,
                  credits: p.credits,
                  amountCents: p.amountCents,
                  discountPercent: p.discountPercent,
                  currency: p.currency,
                }))}
              />
            )}
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">
          You can still earn credits free by starring listed repos or sharing on
          social — buying just skips the wait.
        </p>
        <Link
          href="/wallet"
          className="inline-block text-sm text-muted-foreground hover:underline"
        >
          ← Back to wallet
        </Link>
      </main>
    </>
  );
}
