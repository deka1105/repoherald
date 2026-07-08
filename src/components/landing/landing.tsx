"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { signInWithGitHub } from "@/app/actions/auth";
import "./landing.css";

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

export type LandingCard = {
  id: string;
  fullName: string;
  description: string | null;
  chips: string[];
  stars: string;
  sponsored: boolean;
  highlighted: boolean;
};

function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

function SignInButton({ large }: { large?: boolean }) {
  return (
    <form action={signInWithGitHub} style={{ display: "contents" }}>
      <button type="submit" className={`rh-btn${large ? " rh-btn-lg" : ""}`}>
        <GitHubIcon /> Sign in with GitHub
      </button>
    </form>
  );
}

export function Landing({
  stats,
  cards,
}: {
  stats: LandingStats;
  cards: LandingCard[];
}) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  // localStorage is the source of truth; SSR renders the panel closed and it
  // slides in after hydration unless previously dismissed.
  const panelOpen = !useSyncExternalStore(
    subscribeDismissed,
    () => localStorage.getItem(DISMISS_KEY) === "1",
    () => true
  );
  const openPanel = () => setDismissed(false);
  const dismissPanel = () => setDismissed(true);

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
          <a href="#feed">Explore</a>
          <Link href="/post">Post a repo</Link>
          <button type="button" onClick={openPanel}>
            Sponsor
          </button>
        </div>
        <button
          type="button"
          className="rh-themebtn"
          aria-label="Toggle dark mode"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>
        <SignInButton />
      </nav>
      <hr className="rh-hr" />

      {/* Hero */}
      <header className="rh-hero">
        <div className="rh-eyebrow">
          <span className="rh-star">★</span> Star what deserves to be seen.
        </div>
        <h1 className="rh-h1">Where good repos get found.</h1>
        <p className="rh-sub">
          Post your work, let developers star what deserves attention, and turn
          verified stars into highlight time on the feed.
        </p>
        <div className="rh-cta">
          <SignInButton large />
          <a href="#feed" className="rh-ghost">
            Browse repos
          </a>
        </div>
        <div className="rh-stats">
          <span>
            <span className="rh-glyph">◈</span> {fmt(stats.repoCount)} repos
          </span>
          <span className="rh-dot">·</span>
          <span>
            <span className="rh-glyph">★</span> {fmt(stats.starsClaimed)} stars
            claimed
          </span>
          <span className="rh-dot">·</span>
          <span>{fmt(stats.userCount)} users</span>
        </div>
      </header>
      <div className="rh-container">
        <hr className="rh-hr" />
      </div>

      {/* How it works */}
      <section className="rh-section">
        <div className="rh-label">How it works</div>
        <div className="rh-steps">
          <div className="rh-step">
            <div className="rh-step-index">◇ 01</div>
            <h3>Post your repo</h3>
            <p>Connect GitHub and list any public repository in under a minute.</p>
          </div>
          <div className="rh-step">
            <div className="rh-step-index">★ 02</div>
            <h3>Star &amp; verify</h3>
            <p>
              Real developers star what they value; each star is verified against
              GitHub.
            </p>
          </div>
          <div className="rh-step">
            <div className="rh-step-index">◈ 03</div>
            <h3>Earn highlight time</h3>
            <p>
              Verified stars translate into time featured near the top of the feed.
            </p>
          </div>
        </div>
      </section>
      <div className="rh-container">
        <hr className="rh-hr" />
      </div>

      {/* Feed preview */}
      <section className="rh-section" id="feed">
        <div className="rh-feedhead">
          <div className="rh-label">The feed</div>
          <Link href="/api/auth/signin" className="rh-viewall">
            View all →
          </Link>
        </div>
        <div className="rh-cards">
          {cards.map((c) => (
            <article
              key={c.id}
              className={`rh-card${c.sponsored ? " rh-card-sponsored" : ""}`}
            >
              <div className="rh-avatar">
                {c.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="rh-card-body">
                <div className="rh-card-title">
                  {c.fullName}
                  {c.sponsored && <span className="rh-tag-sponsored">Sponsored</span>}
                  {!c.sponsored && c.highlighted && (
                    <span className="rh-tag-highlighted">
                      <span>★</span> Highlighted
                    </span>
                  )}
                </div>
                {c.description && <p className="rh-card-desc">{c.description}</p>}
                <div className="rh-chips">
                  {c.chips.map((chip) => (
                    <span key={chip} className="rh-chip">
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rh-starcount">
                <span className="rh-star">★</span> {c.stars}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Footer */}
      <hr className="rh-hr" style={{ marginTop: "auto" }} />
      <footer className="rh-foot">
        <span className="rh-userpill">
          <span className="rh-dot-amber" /> {fmt(stats.userCount)} users
        </span>
        <span className="rh-foot-mark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shield} alt="" />
          repoherald
        </span>
        <div className="rh-foot-links">
          <a href="#">Terms</a>
          <a href="#">Privacy</a>
          <a href="https://github.com" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <button type="button" onClick={openPanel}>
            Sponsorships
          </button>
        </div>
      </footer>

      {/* Sponsorship panel */}
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
          <div className="rh-plan">
            <div className="rh-plan-top">
              <span className="rh-plan-duration">7 days · 75 stars</span>
              <span className="rh-plan-price">$49</span>
            </div>
            <div className="rh-plan-benefit">Pinned to the top of the feed.</div>
          </div>
          <div className="rh-plan">
            <div className="rh-plan-top">
              <span className="rh-plan-duration">15 days · 160 stars</span>
              <span className="rh-plan-price">$89</span>
            </div>
            <div className="rh-plan-benefit">
              Featured slot plus category highlight.
            </div>
          </div>
          <div className="rh-plan">
            <div className="rh-plan-top">
              <span className="rh-plan-duration">30 days · 350 stars</span>
              <span className="rh-plan-price">$149</span>
            </div>
            <div className="rh-plan-benefit">Top placement for a full month.</div>
          </div>
        </div>
        <Link href="/sponsor" className="rh-panel-cta">
          Sponsor a repo
        </Link>
        <div className="rh-panel-note">
          Ends whichever comes first — days or stars.
        </div>
      </aside>
    </div>
  );
}
