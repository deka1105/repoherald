import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SupportForm } from "./support-form";
import Link from "next/link";

const FAQ = [
  {
    q: "How do I earn credits?",
    a: "Star any listed repo. Once GitHub verifies the star, it mints 1 credit (subject to daily and weekly caps).",
  },
  {
    q: "How do I boost my own repo?",
    a: "Go to your Wallet and use “Spend on self-highlight” — 1 credit highlights your repo for 1 hour. Highlights queue behind any existing highlight time on that repo.",
  },
  {
    q: "What's the difference between a highlight and a sponsorship?",
    a: "Highlights are credit-funded and short (minutes to hours). Sponsorships are paid via Stripe and pin your repo in the feed for days or until a star cap is hit.",
  },
  {
    q: "Why did my credit balance go negative?",
    a: "If a star you claimed is later un-starred within the revocation window, the credit is clawed back. New credits pay that debt down first.",
  },
];

export const metadata = { title: "Support · repoherald" };

export default async function SupportPage() {
  const session = await auth();
  let email: string | null = null;
  if (session?.user?.id) {
    const acct = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { email: true },
    });
    email = acct?.email ?? null;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Support</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Have a question or hit a snag? Check the common answers below, or send us a
          message and we&apos;ll get back to you by email.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Common questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {FAQ.map((item) => (
            <div key={item.q}>
              <p className="text-sm font-medium">{item.q}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.a}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p className="m-0">
            You can delete your account yourself at any time from{" "}
            <Link href="/wallet" className="underline underline-offset-4">
              your wallet
            </Link>
            . It removes your GitHub token and personal details straight away and hides
            your listings.
          </p>
          <p className="m-0">
            If you can&apos;t sign in, or you want a copy of your data instead, send the
            request using the form below and write &ldquo;data request&rdquo; in the
            subject. We reply within 30 days. See our{" "}
            <Link href="/privacy" className="underline underline-offset-4">
              privacy policy
            </Link>{" "}
            for what we hold.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact us</CardTitle>
        </CardHeader>
        <CardContent>
          <SupportForm email={email} />
        </CardContent>
      </Card>
    </div>
  );
}
