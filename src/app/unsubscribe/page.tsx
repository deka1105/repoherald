import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { Header } from "@/components/header";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";
import { ResubscribeButton } from "./resubscribe";

export const dynamic = "force-dynamic";
export const metadata = { title: "Unsubscribe — repoherald", robots: { index: false } };

/**
 * One-click unsubscribe from an email link. Acts on GET rather than making the
 * reader confirm: an unsubscribe that takes two steps is a dark pattern, and
 * the action is reversible right here if a mail scanner followed the link.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const userId = verifyUnsubscribeToken(token);

  if (userId) {
    await db
      .update(users)
      .set({ sponsorAlertsOptIn: false })
      .where(eq(users.id, userId));
  }

  return (
    <>
      <Header />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-lg flex-1 px-4 py-12">
        {userId ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">You’re unsubscribed</h1>
            <p className="mt-3 leading-7">
              We won’t email you when a new sponsored repository goes live. Account mail you need —
              things like receipts — still sends.
            </p>
            <p className="mt-6">
              <ResubscribeButton token={token ?? ""} />
            </p>
            <p className="mt-6 text-sm text-muted-foreground">
              You can change this any time from <Link href="/wallet" className="underline underline-offset-4">your wallet</Link>.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">This link didn’t work</h1>
            <p className="mt-3 leading-7">
              The unsubscribe link looks incomplete — some mail clients cut long links in half. You
              can turn sponsor alerts off directly from{" "}
              <Link href="/wallet" className="underline underline-offset-4">your wallet</Link>, or ask us
              through <Link href="/support" className="underline underline-offset-4">support</Link> and
              we’ll do it for you.
            </p>
          </>
        )}
      </main>
    </>
  );
}
