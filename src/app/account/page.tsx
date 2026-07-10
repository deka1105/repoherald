import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/db";
import { repos, users } from "@/db/schema";
import { FEED_LAYOUT_COOKIE, parseFeedLayout } from "@/lib/feed-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeChooser } from "@/components/account/theme-chooser";
import { FeedLayoutChooser } from "@/components/account/feed-layout-chooser";
import { MyPosts } from "@/components/account/my-posts";
import { SponsorAlerts } from "@/app/(app)/wallet/sponsor-alerts";
import { DeleteAccount } from "@/app/(app)/wallet/delete-account";

export const metadata = { title: "Account settings — repoherald" };

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const [user, myRepos] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, session.user.id) }),
    db
      .select({
        id: repos.id,
        fullName: repos.fullName,
        status: repos.status,
        starsCount: repos.starsCount,
      })
      .from(repos)
      .where(eq(repos.postedByUserId, session.user.id))
      .orderBy(desc(repos.createdAt)),
  ]);
  if (!user) redirect("/");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Account settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Signed in as {user.githubLogin}. Manage your listings, alerts, and
          appearance.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <ThemeChooser />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your posts</CardTitle>
        </CardHeader>
        <CardContent>
          <MyPosts posts={myRepos} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <SponsorAlerts
            optIn={user.sponsorAlertsOptIn}
            hasEmail={Boolean(user.email)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Wallet &amp; credits</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Your credit balance, rewards, and history live on the{" "}
          <Link href="/wallet" className="underline">
            wallet page
          </Link>
          .
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Permanently delete your account and hide your listings.
          </p>
          <DeleteAccount />
        </CardContent>
      </Card>
    </div>
  );
}
