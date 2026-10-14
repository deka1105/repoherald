import { auth } from "@/auth";
import { getAvailableDiscounts, type AvailableDiscount } from "@/lib/pricing";
import { getFlag } from "@/lib/settings";
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
        role: session.user.role ?? "user",
      }
    : null;

  // Surface any usable discount codes to the logged-in user (best-effort; a
  // failed query must never break the chrome). Admins run the promos, so skip.
  // One read for the whole chrome; the flag is cached for 30s in settings.ts.
  const sponsorships = await getFlag("sponsorshipsEnabled");

  let discounts: AvailableDiscount[] = [];
  if (sponsorships && session?.user && session.user.role !== "admin") {
    try {
      discounts = await getAvailableDiscounts(session.user.id);
    } catch {
      discounts = [];
    }
  }

  return (
    <>
      <HeaderNav user={user} sponsorships={sponsorships} />
      <MobileNav user={user} sponsorships={sponsorships} />
      {user && <WelcomeGuide />}
      {sponsorships && user && discounts.length > 0 && (
        <DiscountPromo codes={discounts} />
      )}
    </>
  );
}
