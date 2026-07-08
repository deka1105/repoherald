import { auth } from "@/auth";
import { HeaderNav, type NavUser } from "@/components/header-nav";
import { MobileNav } from "@/components/mobile-nav";

export async function Header() {
  const session = await auth();
  const user: NavUser | null = session?.user
    ? {
        githubLogin: session.user.githubLogin ?? "",
        image: session.user.image ?? null,
        isAdmin: Boolean(session.user.isAdmin),
      }
    : null;

  return (
    <>
      <HeaderNav user={user} />
      <MobileNav user={user} />
    </>
  );
}
