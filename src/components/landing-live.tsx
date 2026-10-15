"use client";

// The signed-out landing page, ported from the "repoherald landing page"
// design board (desktop/mobile x light/dark, plus the sponsorship panel).
//
// Styling lives in ./landing/landing-v2.css rather than in landing.css,
// because that file's tokens are shared with .rh-chrome in header-nav.tsx and
// cannot change without moving the signed-in app's header with them.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SignInButton as ClerkSignInButton } from "@clerk/nextjs";
import { PlanPrice } from "@/components/plan-price";
import { useTheme } from "@/components/theme-provider";
import "./landing/landing-v2.css";

export type LandingStats = {
  repoCount: number;
  starsClaimed: number;
  userCount: number;
};

export type LandingPlan = {
  key: string;
  durationDays: number;
  starsCap: number | null;
  amountCents: number;
  discountPercent: number;
  currency: string;
};

function planName(p: LandingPlan): string {
  return `${p.durationDays} ${p.durationDays === 1 ? "day" : "days"}`;
}

function planMeta(p: LandingPlan): string {
  const benefit =
    p.durationDays >= 28
      ? "Top placement for a full month"
      : p.durationDays >= 14
        ? "Featured slot plus category highlight"
        : "Pinned to the top of the feed";
  // Both limits are stated because whichever lands first ends the placement.
  return p.starsCap != null ? `${benefit} · ends at ${p.starsCap} stars` : benefit;
}

/** The shield, drawn rather than loaded: two files (black/white PNG) existed
 *  only to follow the theme, and currentColor does that without the request. */
function Shield({ w = 18, h = 22 }: { w?: number; h?: number }) {
  return (
    <svg width={w} height={h} viewBox="0 0 20 24" aria-hidden focusable="false">
      <path
        d="M10 1.4 18.6 4.4 V11.8 C18.6 16.6 15.1 20.6 10 22.6 C4.9 20.6 1.4 16.6 1.4 11.8 V4.4 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M10 7.8 13.1 11.3 10 14.8 6.9 11.3 Z" fill="var(--accent)" />
    </svg>
  );
}

function SunMoon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden focusable="false">
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 1 A7 7 0 0 1 8 15 Z" fill="currentColor" />
    </svg>
  );
}

export function Landing({
  stats,
  plans,
  instagramHandle,
  sponsorships,
  showStats,
}: {
  stats: LandingStats;
  plans: LandingPlan[];
  /**
   * Instagram account that accepts repo suggestions, without the "@". NULL
   * when unset, and the invitation is then omitted entirely rather than
   * rendered against a guessed handle — the same reasoning as the legal
   * identity block in src/lib/legal.ts. A dead or wrong handle on a landing
   * page sends people to a stranger's inbox.
   */
  instagramHandle: string | null;
  /**
   * False withdraws sponsorship from sale: the nav button, the footer button
   * and the whole offers panel go, so the landing never advertises something
   * /promote will refuse to sell.
   */
  sponsorships: boolean;
  /** Whether to print the repo / stars / user counts. */
  showStats: boolean;
}) {
  const { theme: activeTheme, setThemeId } = useTheme();
  const mode = activeTheme.mode;
  const fmt = (n: number) => n.toLocaleString("en-US");

  const [menuOpen, setMenuOpen] = useState(false);

  // Click-to-open, which is the change from the previous landing: that one
  // slid the panel in by itself on a first visit. The design gives the panel a
  // scrim and aria-modal, and a modal that opens itself over the page before
  // anyone asks for it is an interstitial. The nav and footer buttons open it.
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  const openPanel = (e: React.MouseEvent<HTMLButtonElement>) => {
    returnTo.current = e.currentTarget;
    setPanelOpen(true);
  };
  const closePanel = useCallback(() => {
    setPanelOpen(false);
    // Focus goes back where it came from, or it lands at the top of the page.
    returnTo.current?.focus();
    returnTo.current = null;
  }, []);

  useEffect(() => {
    if (!panelOpen) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKey);
    // The panel scrolls its own body; the page behind it should not.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [panelOpen, closePanel]);

  const navItems = (
    <>
      {/* Two different things, deliberately. The feed lives on "/" once you
          are signed in, so Explore still has to open the modal. Search is a
          real page that works signed out, and it reaches the private finds
          the feed will never show. */}
      <li>
        <Link className="rhl-navlink" href="/search">
          Search
        </Link>
      </li>
      <li>
        <ClerkSignInButton mode="modal">
          <button type="button" className="rhl-navlink">
            Explore
          </button>
        </ClerkSignInButton>
      </li>
      <li>
        <Link className="rhl-navlink" href="/post">
          Post a repo
        </Link>
      </li>
      {sponsorships && (
        <li>
          <button
            type="button"
            className="rhl-navlink"
            aria-haspopup="dialog"
            aria-expanded={panelOpen}
            onClick={openPanel}
          >
            <span aria-hidden className="rhl-dot" />
            Sponsor
          </button>
        </li>
      )}
    </>
  );

  return (
    <div className="rhl" data-theme={mode}>
      <a className="rhl-skip" href="#main">
        Skip to content
      </a>

      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="rhl-head">
        <div className="rhl-wrap">
          <Link href="/" className="rhl-mark">
            <Shield />
            <span>repoherald</span>
          </Link>

          <nav aria-label="Main" className="rhl-nav">
            <ul className="rhl-navlist">{navItems}</ul>
          </nav>

          <div className="rhl-headend">
            <button
              type="button"
              className="rhl-iconbtn"
              aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              aria-pressed={mode === "dark"}
              onClick={() => setThemeId(mode === "dark" ? "light" : "dark")}
            >
              <SunMoon />
            </button>
            <button
              type="button"
              className="rhl-menubtn"
              aria-expanded={menuOpen}
              aria-controls="rhl-mnav"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <svg width="14" height="10" viewBox="0 0 14 10" aria-hidden focusable="false">
                <path d="M0 1h14M0 5h14M0 9h14" fill="none" stroke="currentColor" strokeWidth="1.4" />
              </svg>
              Menu
            </button>
            <ClerkSignInButton mode="modal">
              <button type="button" className="rhl-btn">
                Sign in
              </button>
            </ClerkSignInButton>
          </div>
        </div>
      </header>

      {menuOpen && (
        <nav id="rhl-mnav" aria-label="Main" className="rhl-mnav">
          <ul>
            {navItems}
            <li>
              <ClerkSignInButton mode="modal">
                <button type="button">Sign in</button>
              </ClerkSignInButton>
            </li>
          </ul>
        </nav>
      )}

      <main id="main">
        {/* ── Hero ──────────────────────────────────────────────── */}
        <section className="rhl-sec">
          <div className="rhl-wrap">
            <p className="rhl-eyebrow">For everyone who saves more than they read</p>

            <h1 className="rhl-h1">You already found it. Find it again.</h1>

            <p className="rhl-sub">
              Send us a link you saved. A person looks up the repository behind it, catalogues
              what it is and what it&rsquo;s written in, and files it in a private list only you
              can open &mdash; and that you can finally search.
            </p>

            {/* The headline claim, as a working control rather than a promise. A
                plain GET form so a search is a URL, and so it works before any
                JavaScript has loaded. */}
            <form action="/search" method="get" role="search" className="rhl-search">
              <label htmlFor="q" className="rhl-sr">
                Search repositories
              </label>
              <input
                id="q"
                name="q"
                type="search"
                autoComplete="off"
                placeholder="rust, scraper, that 3D thing…"
              />
              <button type="submit" className="rhl-btn">
                Search
              </button>
            </form>

            <div className="rhl-ctas">
              <ClerkSignInButton mode="modal">
                <button type="button" className="rhl-btn">
                  Sign in
                </button>
              </ClerkSignInButton>
              <ClerkSignInButton mode="modal">
                <button type="button" className="rhl-ghost">
                  Sign in to search your own
                </button>
              </ClerkSignInButton>
            </div>

            {/* Clickwrap: the terms are named and linked at the point of
                agreeing, not buried in a footer. */}
            <p className="rhl-consent">
              Google or email. By signing in you agree to our <Link href="/terms">Terms</Link> and{" "}
              <Link href="/privacy">Privacy notice</Link>. Connecting GitHub is optional and
              read-only, and is only needed to post your own work.
            </p>

            {showStats && (
              <ul className="rhl-stats">
                <li>
                  <span className="rhl-stat-n">{fmt(stats.repoCount)}</span>
                  <span>{stats.repoCount === 1 ? "repo" : "repos"}</span>
                </li>
                <li>
                  <span className="rhl-stat-n">{fmt(stats.starsClaimed)}</span>
                  <span>{stats.starsClaimed === 1 ? "star claimed" : "stars claimed"}</span>
                </li>
                <li>
                  <span className="rhl-stat-n">{fmt(stats.userCount)}</span>
                  <span>{stats.userCount === 1 ? "user" : "users"}</span>
                </li>
              </ul>
            )}
          </div>
        </section>

        {/* ── What this is for ──────────────────────────────────── */}
        <section className="rhl-sec">
          <div className="rhl-wrap">
            <h2 className="rhl-h2">What this is for</h2>
            <p className="rhl-lede">In the order it matters.</p>

            <div className="rhl-cards">
              <article className="rhl-card">
                <span aria-hidden className="rhl-card-glyph">
                  ◇
                </span>
                <p className="rhl-card-num">01</p>
                <h3>Send us what you saved</h3>
                <p>
                  DM a link to our Instagram &mdash; a reel, a post, something three months deep
                  in a thread. We find the repository behind it, catalogue it, and file it in your
                  private list. A person reviews every suggestion. Nothing is published.
                </p>
              </article>

              <article className="rhl-card">
                <span aria-hidden className="rhl-card-glyph">
                  ★
                </span>
                <p className="rhl-card-num">02</p>
                <h3>Share a list with anyone</h3>
                <p>
                  Group repos into a list and send someone the link. They don&rsquo;t need an
                  account to open it. You stay the owner, and you decide whether anyone else can
                  add to it.
                </p>
              </article>

              <article className="rhl-card">
                <span aria-hidden className="rhl-card-glyph">
                  ◈
                </span>
                <p className="rhl-card-num">03</p>
                <h3>Share your own work</h3>
                <p>
                  Optionally connect GitHub, read-only, and list a repo you own so other
                  developers find it and star it. It&rsquo;s the one GitHub-shaped step here, and
                  nothing else in repoherald needs it.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* ── Found it somewhere else ───────────────────────────── */}
        {instagramHandle && (
          <section className="rhl-amber">
            <div className="rhl-wrap">
              <h2 className="rhl-amber-h">
                Your saved folder is full of repos you never opened.
              </h2>
              <p className="rhl-amber-p">
                You saved it because it looked useful. Then it sank into a thread and you&rsquo;ve
                been searching the wrong app for it ever since. Send it here instead &mdash; one
                DM, and it comes back as something you can actually search.
              </p>
              <a
                className="rhl-btn rhl-btn-lg"
                href={`https://www.instagram.com/${instagramHandle}/`}
                target="_blank"
                rel="noreferrer"
              >
                DM us a link on Instagram
                <span aria-hidden className="rhl-mono">
                  →
                </span>
              </a>
              {/* The link and who sent it are kept for the reviewer and never
                  published — the claim /privacy makes, made here too. */}
              <p className="rhl-amber-note">
                @{instagramHandle} · a person reads every one. We keep the link and who sent it so
                that reviewer has the context; neither is ever published, as our{" "}
                <Link href="/privacy">Privacy notice</Link> sets out.
              </p>
            </div>
          </section>
        )}

        {/* ── Upcoming ──────────────────────────────────────────── */}
        <section className="rhl-sec">
          <div className="rhl-wrap">
            <h2 className="rhl-h2">Upcoming</h2>
            <p className="rhl-lede">
              Neither of these works today. They&rsquo;re here so you know what&rsquo;s coming
              &mdash; not what you&rsquo;re getting.
            </p>

            <div className="rhl-rows">
              <div className="rhl-row">
                <div className="rhl-row-head">
                  <h3>Browser extension</h3>
                  <span className="rhl-tag">Not built yet</span>
                </div>
                <p>
                  The plan is to send a repo from the page you&rsquo;re on, without the detour
                  through a DM. It doesn&rsquo;t exist yet.
                </p>
              </div>

              <div className="rhl-row">
                <div className="rhl-row-head">
                  <h3>TikTok</h3>
                  <span className="rhl-tag">Not built yet</span>
                </div>
                <p>
                  You can claim a TikTok handle today, so it&rsquo;s yours when this lands. Nothing
                  is swept from it yet &mdash; send TikTok links by DM like any other.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="rhl-foot">
        <div className="rhl-wrap">
          {/* A disclosure, not a consent wall: there is nothing here to opt
              into. Dismissal belongs to StorageNotice in the root layout, so
              this block states what is stored and links to the detail rather
              than carrying a second, competing "accept" button. */}
          <aside aria-label="Cookies and storage" className="rhl-notice">
            <p>
              <strong>repoherald stores two cookies.</strong> One keeps you signed in, one
              remembers whether you chose light or dark. Both are exempt from consent &mdash;
              there is nothing here to opt into. View counts are cookieless and store no IP
              address.
            </p>
            <Link href="/cookies" className="rhl-ghost">
              What we store
            </Link>
          </aside>

          <div className="rhl-foot-grid">
            <div className="rhl-foot-mark">
              <span>
                <Shield w={16} h={19} />
                repoherald
              </span>
              <p>Your finds stay in your private list. Nothing you send us is published.</p>
            </div>

            <nav aria-label="Footer" className="rhl-footnav">
              <ul>
                <li>
                  <Link href="/terms">Terms</Link>
                </li>
                <li>
                  <Link href="/privacy">Privacy</Link>
                </li>
                <li>
                  <Link href="/cookies">Cookies</Link>
                </li>
                <li>
                  <Link href="/refunds">Refunds</Link>
                </li>
                <li>
                  <Link href="/support">Support</Link>
                </li>
                {sponsorships && (
                  <li>
                    <button
                      type="button"
                      aria-haspopup="dialog"
                      aria-expanded={panelOpen}
                      onClick={openPanel}
                    >
                      Sponsorships
                    </button>
                  </li>
                )}
              </ul>
            </nav>
          </div>

          <p className="rhl-copy">© {new Date().getFullYear()} repoherald</p>
        </div>
      </footer>

      {/* ── Sponsorship panel ─────────────────────────────────────── */}
      {sponsorships && panelOpen && (
        <>
          <div aria-hidden className="rhl-scrim" onClick={closePanel} />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rhl-sponsor-title"
            tabIndex={-1}
            className="rhl-panel"
          >
            <div className="rhl-panel-head">
              <div>
                <p className="rhl-panel-eyebrow">
                  <span aria-hidden className="rhl-dot" />
                  Sponsorship
                </p>
                <h2 id="rhl-sponsor-title" className="rhl-panel-h">
                  Pin a repo to the top of the Explore feed
                </h2>
                <p className="rhl-panel-p">
                  Paid placement on the Explore feed, for repos listed there. It never touches
                  anyone&rsquo;s private lists.
                </p>
              </div>
              <button
                type="button"
                className="rhl-iconbtn"
                aria-label="Close sponsorship panel"
                onClick={closePanel}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden focusable="false">
                  <path d="M1 1 13 13M13 1 1 13" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </button>
            </div>

            <div className="rhl-panel-body">
              <ul className="rhl-plans">
                {plans.map((p) => (
                  <li className="rhl-plan" key={p.key}>
                    <div className="rhl-plan-main">
                      <p className="rhl-plan-name">{planName(p)}</p>
                      <p className="rhl-plan-meta">{planMeta(p)}</p>
                    </div>
                    <p className="rhl-plan-price">
                      <PlanPrice
                        amountCents={p.amountCents}
                        discountPercent={p.discountPercent}
                        currency={p.currency}
                      />
                    </p>
                    <Link href="/promote" className="rhl-btn">
                      Choose
                    </Link>
                  </li>
                ))}
              </ul>

              <p className="rhl-panel-note">
                Ends whichever comes first — days or stars. Payment and the exact dates are
                confirmed at checkout. See <Link href="/refunds">Refunds</Link>.
              </p>

              <div className="rhl-panel-callout">
                <p>
                  <strong>Only repos you listed yourself can be pinned.</strong> Sponsorship
                  can&rsquo;t promote a repo out of someone&rsquo;s private list, and it never
                  changes what a search returns.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
