"use client";

import Link from "next/link";
import { signInWithGitHub, signOutAction } from "@/app/actions/auth";
import { useTheme } from "@/components/theme-provider";
import { ThemePicker } from "@/components/theme-picker";
import "@/components/landing/landing.css";

export type NavUser = {
  githubLogin: string;
  image: string | null;
  isAdmin: boolean;
};

function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export function HeaderNav({ user }: { user: NavUser | null }) {
  const { theme } = useTheme();
  // The chrome (rh-* tokens) only renders light/dark; each design theme maps
  // to one of those via its mode.
  const mode = theme.mode;
  const shield = mode === "dark" ? "/brand/shield-white.png" : "/brand/shield-black.png";

  return (
    <header className="rh-chrome" data-theme={mode}>
      <nav className="rh-nav">
        <Link href="/" className="rh-wordmark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shield} alt="" />
          repoherald
        </Link>
        <div className="rh-navlinks">
          <Link href="/">Explore</Link>
          <Link href="/post">Post a repo</Link>
          <Link href="/sponsor">Sponsor</Link>
          <Link href="/support">Support</Link>
          {user && <Link href="/wallet">Wallet</Link>}
          {user?.isAdmin && <Link href="/admin">Admin</Link>}
        </div>
        <ThemePicker />
        {user ? (
          <div className="rh-user">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="rh-user-avatar" src={user.image} alt="" />
            ) : (
              <span className="rh-user-avatar" />
            )}
            <span className="rh-user-name">{user.githubLogin}</span>
            <form action={signOutAction} style={{ display: "contents" }}>
              <button type="submit" className="rh-signout">
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <form action={signInWithGitHub} style={{ display: "contents" }}>
            <button type="submit" className="rh-btn">
              <GitHubIcon /> Sign in with GitHub
            </button>
          </form>
        )}
      </nav>
      <hr className="rh-hr" />
    </header>
  );
}
