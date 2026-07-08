import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/sponsorships", label: "Sponsorships" },
  { href: "/admin/listings", label: "Listings" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/anomalies", label: "Anomalies" },
  { href: "/admin/rewards", label: "Rewards" },
  { href: "/admin/support", label: "Support" },
  { href: "/admin/audit", label: "Audit log" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.isAdmin) notFound();

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-4 border-b pb-3 text-sm">
        {NAV.map((item) => (
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
