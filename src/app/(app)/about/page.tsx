import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbs } from "@/lib/schema";
import { LEGAL } from "@/lib/legal";
import { FEED_ALTERNATE, SITE_NAME } from "@/lib/site";

/**
 * What this site is, who runs it, and how to reach them.
 *
 * Every claim here is a fact already recorded in the code: the credit rules
 * come from src/lib/credits.ts, the identification ladder from
 * src/lib/resolve-repo.ts, the measurement claims from src/lib/analytics.ts.
 * Keep it that way — this page is as much a factual-accuracy surface as the
 * policy pages, and the same rule applies: if what the code does changes,
 * change this in the same commit.
 *
 * The operator block follows src/lib/legal.ts and is **omitted** when
 * LEGAL_ENTITY_NAME is unset, rather than filled with a plausible name. An
 * invented operator on an "about" page is the same lie as one on /privacy.
 */

const DESCRIPTION =
  "What repoherald is, how repositories get catalogued, how credits work, and how to get in touch.";

export const metadata: Metadata = {
  title: `About — ${SITE_NAME}`,
  description: DESCRIPTION,
  alternates: {
    canonical: "/about",
    types: { "application/rss+xml": FEED_ALTERNATE },
  },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <JsonLd
        data={breadcrumbs([
          { name: SITE_NAME, path: "/" },
          { name: "About", path: "/about" },
        ])}
      />

      <div>
        <h1 className="text-2xl font-semibold">About {SITE_NAME}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{DESCRIPTION}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What this is</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p className="m-0">
            {SITE_NAME} is a catalogue of GitHub repositories that people posted
            on purpose. It is much smaller than GitHub and deliberately so:
            every entry was submitted by a person and filed under what it is for
            and what it is written in, so you can search it by use case and
            sector rather than by remembering the name.
          </p>
          <p className="m-0">
            It exists for the repository you already found once. You saved the
            post because the tool looked useful, it sank into a thread, and
            there was no title and no search to get it back. Send the link
            instead of saving it and it returns as a catalogue entry.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How a repository gets listed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p className="m-0">
            Two ways. You can{" "}
            <Link href="/post" className="underline underline-offset-4">
              post a repository you own
            </Link>{" "}
            by connecting GitHub read-only, or you can send a link to a post and
            let us work out which repository it is about.
          </p>
          <p className="m-0">
            That second path is the interesting one, and you can{" "}
            <Link href="/identify" className="underline underline-offset-4">
              try it yourself
            </Link>
            . A model reads the caption, any text in the image and the
            transcript, and proposes a repository — but it never decides. Every
            candidate is checked against the GitHub API, and one that does not
            resolve is discarded no matter how confident the model claimed to
            be. The system can answer &ldquo;I don&rsquo;t know&rdquo;, and that
            answer routes to a human reviewer. It cannot invent a repository.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Credits and highlights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p className="m-0">
            Star a listed repository and, once GitHub confirms the star, it
            mints 1 credit. One credit buys an hour of highlight time on a
            repository you own, or fifteen minutes donated to someone
            else&rsquo;s. Un-star within the revocation window and the credit is
            clawed back, which is why a balance can go negative.
          </p>
          <p className="m-0">
            Sponsorships are the paid version and are kept separate: they are
            bought through Stripe, pin a repository in the feed, and are always
            distinguishable from a credit-funded highlight. Full terms are on{" "}
            <Link href="/terms" className="underline underline-offset-4">
              our terms page
            </Link>
            , and refunds on{" "}
            <Link href="/refunds" className="underline underline-offset-4">
              refunds
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">For agents and machines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p className="m-0">
            The catalogue is readable by software as well as by people. There is
            an MCP server at <code>/api/mcp</code> for browsing, searching and
            reading listings, an{" "}
            <a href="/feed.xml" className="underline underline-offset-4">
              RSS feed
            </a>{" "}
            of new entries, and an{" "}
            <a href="/llms.txt" className="underline underline-offset-4">
              llms.txt
            </a>{" "}
            describing what is here. AI crawlers are not blocked.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How we measure</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p className="m-0">
            View counting is first-party and cookieless: a daily-rotating salted
            hash stands in for a visitor, and your IP address is never written
            to our database. We record the country a request came from and
            nothing finer. Global Privacy Control is honoured automatically, and
            the switch on{" "}
            <Link href="/cookies" className="underline underline-offset-4">
              our cookie page
            </Link>{" "}
            stops your browser sending view events at all.
          </p>
          <p className="m-0">
            What we hold and why is set out in full in our{" "}
            <Link href="/privacy" className="underline underline-offset-4">
              privacy notice
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Who runs this</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {LEGAL.entityName ? (
            <>
              <p className="m-0">
                {SITE_NAME} is operated by {LEGAL.entityName}
                {LEGAL.jurisdiction ? `, ${LEGAL.jurisdiction}` : ""}.
              </p>
              {LEGAL.entityAddress && (
                <p className="m-0 whitespace-pre-line">{LEGAL.entityAddress}</p>
              )}
            </>
          ) : (
            <p className="m-0">
              {SITE_NAME} is an independent project rather than a registered
              company. There is no operator entity to name yet, so this page
              does not name one.
            </p>
          )}
          <p className="m-0">
            The reliable way to reach us is the form on{" "}
            <Link href="/support" className="underline underline-offset-4">
              our support page
            </Link>
            {LEGAL.contactEmail ? (
              <>
                , or by email at{" "}
                <a
                  href={`mailto:${LEGAL.contactEmail}`}
                  className="underline underline-offset-4"
                >
                  {LEGAL.contactEmail}
                </a>
              </>
            ) : null}
            . Data requests are answered within 30 days.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
