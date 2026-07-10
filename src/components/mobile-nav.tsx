"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  LifeBuoy,
  Megaphone,
  Settings,
  ShieldCheck,
  SquarePlus,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { NavUser } from "@/components/header-nav";

type Tab = {
  href: string;
  label: string;
  Icon: LucideIcon;
  isActive: (pathname: string) => boolean;
  requiresUser?: boolean;
  adminOnly?: boolean;
  hideForAdmin?: boolean;
};

const TABS: Tab[] = [
  {
    href: "/",
    label: "Explore",
    Icon: Compass,
    isActive: (p) => p === "/" || p.startsWith("/repos"),
  },
  { href: "/post", label: "Post", Icon: SquarePlus, isActive: (p) => p.startsWith("/post") },
  {
    href: "/wallet",
    label: "Wallet",
    Icon: Wallet,
    isActive: (p) => p.startsWith("/wallet"),
    requiresUser: true,
  },
  {
    href: "/sponsor",
    label: "Sponsor",
    Icon: Megaphone,
    isActive: (p) => p.startsWith("/sponsor"),
  },
  {
    href: "/support",
    label: "Support",
    Icon: LifeBuoy,
    isActive: (p) => p.startsWith("/support"),
    hideForAdmin: true,
  },
  {
    href: "/account",
    label: "Account",
    Icon: Settings,
    isActive: (p) => p.startsWith("/account"),
    requiresUser: true,
  },
  {
    href: "/admin",
    label: "Admin",
    Icon: ShieldCheck,
    isActive: (p) => p.startsWith("/admin"),
    adminOnly: true,
  },
];

// Bottom tab bar — the app's primary navigation on phones, where the top nav
// links are hidden. Hidden at md+ where the top nav takes over.
export function MobileNav({ user }: { user: NavUser | null }) {
  const pathname = usePathname();
  const tabs = TABS.filter(
    (t) =>
      (!t.requiresUser || user) &&
      (!t.adminOnly || user?.isAdmin) &&
      (!t.hideForAdmin || !user?.isAdmin)
  );

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {tabs.map(({ href, label, Icon, isActive }) => {
          const active = isActive(pathname);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
