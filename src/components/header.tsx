import { auth } from "@/auth";
import { getAvailableDiscounts, type AvailableDiscount } from "@/lib/pricing";
import { HeaderNav, type NavUser } from "@/components/header-nav";
import { MobileNav } from "@/components/mobile-nav";
import { WelcomeGuide } from "@/components/welcome-guide";
import { DiscountPromo } from "@/components/discount-promo";

export async function Header() {
  const session = await auth();
  const user: NavUser | null = session?.user
    ? {
        githubLogin: session.user.githubLogin ?? "",
        image: session.user.image ?? null,
        isAdmin: Boolean(session.user.isAdmin),
      }
    : null;

  // Surface any usable discount codes to the logged-in user (best-effort; a
  // failed query must never break the chrome). Admins run the promos, so skip.
  let discounts: AvailableDiscount[] = [];
  if (session?.user && !session.user.isAdmin) {
    try {
      discounts = await getAvailableDiscounts(session.user.id);
    } catch {
      discounts = [];
    }
  }

  return (
    <>
      <HeaderNav user={user} />
      <MobileNav user={user} />
      {user && <WelcomeGuide />}
      {user && discounts.length > 0 && <DiscountPromo codes={discounts} />}
    </>
  );
}
