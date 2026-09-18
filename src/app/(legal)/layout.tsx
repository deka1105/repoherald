import Link from "next/link";
import { Header } from "@/components/header";
import { LEGAL, hasBusinessIdentity } from "@/lib/legal";

const DOCS = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/cookies", label: "Cookies" },
  { href: "/refunds", label: "Refunds" },
];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 pb-24 md:pb-14">
        {/* Sibling documents, so a reader who lands on one can reach the rest. */}
        <nav aria-label="Legal documents" className="mb-8 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {DOCS.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              className="text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:text-foreground"
            >
              {d.label}
            </Link>
          ))}
        </nav>

        {/* `prose` is not available here, so spacing/typography is explicit. */}
        <article
          className="
            [&_h1]:mb-2 [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-tight
            [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold
            [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold
            [&_p]:my-4 [&_p]:leading-7
            [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:my-1.5 [&_li]:leading-7
            [&_table]:my-4 [&_table]:w-full [&_table]:text-left [&_table]:text-sm
            [&_th]:border-b [&_th]:py-2 [&_th]:pr-4 [&_th]:font-semibold [&_th]:align-top
            [&_td]:border-b [&_td]:py-2 [&_td]:pr-4 [&_td]:align-top
            [&_a]:underline [&_a]:underline-offset-4
          "
        >
          {children}
        </article>

        <footer className="mt-12 border-t pt-6 text-sm text-muted-foreground">
          <p className="my-0">
            Last updated {LEGAL.lastUpdated}.{" "}
            {LEGAL.contactEmail ? (
              <>
                Questions: <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a> or{" "}
                <Link href="/support">our support form</Link>.
              </>
            ) : (
              <>
                Questions: <Link href="/support">our support form</Link>.
              </>
            )}
          </p>
          {hasBusinessIdentity() && (
            <address className="mt-3 not-italic">
              {LEGAL.entityName}
              {LEGAL.entityAddress?.split("\n").map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>
          )}
        </footer>
      </main>
    </>
  );
}
