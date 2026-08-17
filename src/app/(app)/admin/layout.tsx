import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";

// adminOnly tabs stay hidden from moderators; the pages behind them also
// enforce the role server-side (hiding a link is not access control).
const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/sponsorships", label: "Sponsorships", adminOnly: true },
  { href: "/admin/listings", label: "Listings" },
  { href: "/admin/lists", label: "Lists" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/anomalies", label: "Anomalies" },
  { href: "/admin/rewards", label: "Rewards" },
  { href: "/admin/support", label: "Support" },
  { href: "/admin/audit", label: "Audit log", adminOnly: true },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const role = session?.user?.role;
  if (role !== "admin" && role !== "moderator") notFound();

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-4 border-b pb-3 text-sm">
        {NAV.filter((item) => !item.adminOnly || role === "admin").map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-muted-foreground hover:text-foreground"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
