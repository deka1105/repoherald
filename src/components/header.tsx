import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export async function Header() {
  const session = await auth();

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold tracking-tight">
            repoherald
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              Explore
            </Link>
            {session && (
              <>
                <Link href="/post" className="hover:text-foreground">
                  Post a repo
                </Link>
                <Link href="/wallet" className="hover:text-foreground">
                  Wallet
                </Link>
                <Link href="/sponsor" className="hover:text-foreground">
                  Sponsor
                </Link>
                {session.user.isAdmin && (
                  <Link href="/admin" className="hover:text-foreground">
                    Admin
                  </Link>
                )}
              </>
            )}
          </nav>
        </div>
        {session ? (
          <div className="flex items-center gap-3">
            <Avatar className="size-7">
              <AvatarImage src={session.user.image ?? undefined} />
              <AvatarFallback>
                {session.user.githubLogin?.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground">
              {session.user.githubLogin}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut();
              }}
            >
              <Button variant="outline" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        ) : (
          <form
            action={async () => {
              "use server";
              await signIn("github");
            }}
          >
            <Button size="sm" type="submit">
              Sign in with GitHub
            </Button>
          </form>
        )}
      </div>
    </header>
  );
}
