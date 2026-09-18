import Link from "next/link";
import { LEGAL, hasBusinessIdentity } from "@/lib/legal";

const LINKS = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/cookies", label: "Cookies" },
  { href: "/refunds", label: "Refunds" },
  { href: "/support", label: "Support" },
];

/**
 * Policy footer for the signed-in app shell. The landing has its own footer
 * with the same links; this makes them reachable from every other page, which
 * is the part regulators actually care about.
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t px-4 py-6 text-sm text-muted-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Legal and support" className="flex flex-wrap gap-x-4 gap-y-2">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="underline underline-offset-4 hover:text-foreground focus-visible:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="m-0">
          {hasBusinessIdentity() ? (
            <>
              © {new Date().getFullYear()} {LEGAL.entityName}
            </>
          ) : (
            <>
              © {new Date().getFullYear()} {LEGAL.serviceName}
            </>
          )}
        </p>
      </div>
    </footer>
  );
}
