"use client";

// Owned replacement for src/components/landing/landing.tsx (root-owned,
// uneditable): identical markup/CSS, but the sponsorship plans are passed in
// from the DB instead of hardcoded, and the CTA points at /promote.

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { SignInButton as ClerkSignInButton } from "@clerk/nextjs";
import { PlanPrice } from "@/components/plan-price";
import { useTheme } from "@/components/theme-provider";
import "./landing/landing.css";

const DISMISS_KEY = "rh_sponsor_dismissed";
const DISMISS_EVENT = "rh-sponsor-change";

function subscribeDismissed(cb: () => void) {
  window.addEventListener(DISMISS_EVENT, cb);
  return () => window.removeEventListener(DISMISS_EVENT, cb);
}

function setDismissed(value: boolean) {
  localStorage.setItem(DISMISS_KEY, value ? "1" : "0");
  window.dispatchEvent(new Event(DISMISS_EVENT));
}

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

function planBenefit(p: LandingPlan): string {
  if (p.durationDays >= 28) return "Top placement for a full month.";
  if (p.durationDays >= 14) return "Featured slot plus category highlight.";
  return "Pinned to the top of the feed.";
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

function SignInButton({ large }: { large?: boolean }) {
  // Modal rather than a redirect: the landing is one long page and sending
  // somebody away from it to come back loses their place in it.
  return (
    <ClerkSignInButton mode="modal">
      <button type="button" className={`rh-btn${large ? " rh-btn-lg" : ""}`}>
        <GitHubIcon /> Sign in
      </button>
    </ClerkSignInButton>
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
  // Was local useState, which meant the landing's toggle persisted nothing and
  // reset to light on every load while the rest of the app remembered its own
  // theme. Now it drives the same cookie-backed provider as the app chrome.
  const { theme: activeTheme, setThemeId } = useTheme();
  const theme = activeTheme.mode;
  // localStorage is the source of truth; SSR renders the panel closed and it
  // slides in after hydration unless previously dismissed.
  const panelOpen = !useSyncExternalStore(
    subscribeDismissed,
    () => localStorage.getItem(DISMISS_KEY) === "1",
    () => true
  );
  const openPanel = () => setDismissed(false);
  const dismissPanel = () => setDismissed(true);

  // Escape closes it, which anything with role="dialog" is expected to honour.
  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDismissed(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen]);

  const shield = theme === "dark" ? "/brand/shield-white.png" : "/brand/shield-black.png";
  const fmt = (n: number) => n.toLocaleString("en-US");

  return (
    <div className="rh" data-theme={theme}>
      {/* Nav */}
      <nav className="rh-nav">
        <Link href="/" className="rh-wordmark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shield} alt="" />
          repoherald
        </Link>
        <div className="rh-navlinks">
          {/* Two different things, deliberately. The feed lives on "/" once you
              are signed in, so Explore still has to open the modal. Search is a
              real page that works signed out, and it reaches the private finds
              the feed will never show. */}
          <Link href="/search">Search</Link>
          <ClerkSignInButton mode="modal">
            <button type="button">Explore</button>
          </ClerkSignInButton>
          <Link href="/post">Post a repo</Link>
          {sponsorships && (
            <button type="button" onClick={openPanel}>
              Sponsor
            </button>
          )}
        </div>
        <button
          type="button"
          className="rh-themebtn"
          aria-label="Toggle dark mode"
          onClick={() => setThemeId(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>
        <SignInButton />
      </nav>
      <hr className="rh-hr" />

      {/* Hero */}
      <header className="rh-hero">
        <div className="rh-eyebrow">
          <span className="rh-star">★</span> For everyone who saves more than they read.
        </div>
        <h1 className="rh-h1">You already found it. Find it again.</h1>
        <p className="rh-sub">
          Send us the repos and tools you save anywhere — a reel, a post, a
          thread you scrolled past. We look each one up, catalogue it, and put
          it somewhere you can search.
        </p>
        {/* The headline claim, as a working control rather than a promise. A
            plain GET form so a search is a URL, and so it works before any
            JavaScript has loaded. */}
        <form action="/search" method="get" className="rh-cta" role="search">
          <input
            name="q"
            type="search"
            placeholder="rust, scraper, that 3D thing…"
            aria-label="Search repositories"
            style={{
              flex: "1 1 240px",
              minWidth: 0,
              padding: "11px 14px",
              borderRadius: 10,
              border: "1px solid rgba(128,128,128,0.35)",
              background: "transparent",
              color: "inherit",
              font: "inherit",
            }}
          />
          <button type="submit" className="rh-btn rh-btn-lg">
            Search
          </button>
        </form>
        <div className="rh-cta">
          <SignInButton large />
          <ClerkSignInButton mode="modal">
            <button type="button" className="rh-ghost">
              Sign in to search your own
            </button>
          </ClerkSignInButton>
        </div>
        {/* Clickwrap: the terms are named and linked at the point of agreeing,
            not buried in a footer. */}
        <p className="rh-consent">
          By signing in you agree to our{" "}
          <Link href="/terms">Terms of Service</Link> and{" "}
          <Link href="/privacy">Privacy Policy</Link>. You sign in with Google or
          an email address. Connecting GitHub is optional, read-only, and only
          needed to post your own work — we never post on your behalf.
        </p>
        {showStats && (
          <div className="rh-stats">
            <span>
              <span className="rh-glyph">◈</span> {fmt(stats.repoCount)}{" "}
              {stats.repoCount === 1 ? "repo" : "repos"}
            </span>
            <span className="rh-dot">·</span>
            <span>
              <span className="rh-glyph">★</span> {fmt(stats.starsClaimed)}{" "}
              {stats.starsClaimed === 1 ? "star" : "stars"} claimed
            </span>
            <span className="rh-dot">·</span>
            <span>
              {fmt(stats.userCount)} {stats.userCount === 1 ? "user" : "users"}
            </span>
          </div>
        )}
      </header>
      <div className="rh-container">
        <hr className="rh-hr" />
      </div>

      {/* How it works */}
      <section className="rh-section">
        <div className="rh-label">What this is for</div>
        <div className="rh-steps">
          <div className="rh-step">
            <div className="rh-step-index">◇ 01</div>
            <h3>Send us what you saved</h3>
            <p>
              A reel, a post, a link buried in a thread. Send it over and we look
              up the repository behind it — what it is, what it&apos;s written in,
              what it actually does.
            </p>
          </div>
          <div className="rh-step">
            <div className="rh-step-index">★ 02</div>
            <h3>Share a list with anyone</h3>
            <p>
              Group repos into a list and send someone the link. They don&apos;t
              need an account to open it, and you decide whether anyone can add
              to it.
            </p>
          </div>
          <div className="rh-step">
            <div className="rh-step-index">◈ 03</div>
            <h3>Share your own work</h3>
            <p>
              Connect GitHub and list a repository you own, so other developers
              can find it and star it. Optional — nothing else here needs it.
            </p>
          </div>
        </div>
      </section>
      <div className="rh-container">
        <hr className="rh-hr" />
      </div>

      {/* Send us what you saved — only when there is somewhere to send it */}
      {instagramHandle && (
        <>
          <section className="rh-section">
            <div className="rh-label">Found it somewhere else</div>
            <div className="rh-send">
              <div className="rh-send-body">
                <h2 className="rh-send-h">
                  Your saved folder is full of repos you never opened.
                </h2>
                <p className="rh-send-p">
                  Everyone has one — a reel about some tool you meant to look at
                  later, buried three months deep. Send them over and we&apos;ll do
                  the digging: we look up every repository, catalogue it, and file
                  it into a private list that only you can open — and that you can
                  finally search.
                </p>
                <p className="rh-send-note">
                  Send the links to <strong>@{instagramHandle}</strong> — a reel, a
                  post, a thread, wherever you found it. A person reviews every
                  suggestion, so nothing is listed automatically. We keep the link
                  and who sent it so that reviewer has the context;{" "}
                  <strong>neither is ever published</strong>, as our{" "}
                  <Link href="/privacy">Privacy Policy</Link> sets out.
                </p>
              </div>
              <a
                className="rh-btn rh-btn-lg rh-send-cta"
                href={`https://www.instagram.com/${instagramHandle}/`}
                target="_blank"
                rel="noreferrer"
              >
                Send us a repo →
              </a>
            </div>
          </section>
          <div className="rh-container">
            <hr className="rh-hr" />
          </div>
        </>
      )}

      {/* Upcoming — named as not-yet-built, so the page stops short of
          promising them the way the old copy promised a feed that had gone. */}
      <section className="rh-section">
        <div className="rh-label">Upcoming</div>
        <div className="rh-steps">
          <div className="rh-step">
            <div className="rh-step-index">◇ Soon</div>
            <h3>Browser extension</h3>
            <p>
              Save a repo from wherever you already are, without copying a link
              into a message first.
            </p>
          </div>
          <div className="rh-step">
            <div className="rh-step-index">◈ Soon</div>
            <h3>TikTok</h3>
            <p>
              Send finds from TikTok the same way you send them from Instagram.
              You can claim your TikTok handle today; the sweep comes next.
            </p>
          </div>
        </div>
      </section>
      <div className="rh-container">
        <hr className="rh-hr" />
      </div>

      {/* Footer */}
      <hr className="rh-hr" style={{ marginTop: "auto" }} />
      <footer className="rh-foot">
        {/* The empty span keeps the wordmark centred: .rh-foot is
            space-between across three children. */}
        {showStats ? (
          <span className="rh-userpill">
            <span className="rh-dot-amber" /> {fmt(stats.userCount)}{" "}
            {stats.userCount === 1 ? "user" : "users"}
          </span>
        ) : (
          <span />
        )}
        <span className="rh-foot-mark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shield} alt="" />
          repoherald
        </span>
        <div className="rh-foot-links">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/cookies">Cookies</Link>
          <Link href="/refunds">Refunds</Link>
          <Link href="/support">Support</Link>
          <a href="https://github.com" target="_blank" rel="noreferrer">
            GitHub
          </a>
          {sponsorships && (
            <button type="button" onClick={openPanel}>
              Sponsorships
            </button>
          )}
        </div>
      </footer>

      {/* Sponsorship panel */}
      {sponsorships && (
      <aside
        role="dialog"
        aria-label="Sponsorship offers"
        className="rh-panel"
        data-open={panelOpen}
      >
        <div className="rh-panel-head">
          <div>
            <h2>Sponsor a repo</h2>
            <p>Pin great work to the top of the feed.</p>
          </div>
          <button
            type="button"
            className="rh-panel-close"
            aria-label="Close sponsorship offers"
            onClick={dismissPanel}
          >
            ×
          </button>
        </div>
        <div className="rh-plans">
          {plans.map((p) => (
            <div className="rh-plan" key={p.key}>
              <div className="rh-plan-top">
                <span className="rh-plan-duration">
                  {p.durationDays} days
                  {p.starsCap != null && <> · {p.starsCap} stars</>}
                </span>
                <span className="rh-plan-price">
                  <PlanPrice
                    amountCents={p.amountCents}
                    discountPercent={p.discountPercent}
                    currency={p.currency}
                  />
                </span>
              </div>
              <div className="rh-plan-benefit">{planBenefit(p)}</div>
            </div>
          ))}
        </div>
        <Link href="/promote" className="rh-panel-cta">
          Sponsor a repo
        </Link>
        <div className="rh-panel-note">
          Ends whichever comes first — days or stars.
        </div>
      </aside>
      )}
    </div>
  );
}
