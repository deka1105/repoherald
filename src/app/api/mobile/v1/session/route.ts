import { NextResponse } from "next/server";
import { upsertGithubUser, type GithubProfile } from "@/lib/github-user";
import { mintMobileToken } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

/**
 * Exchange a GitHub access token for a repoherald bearer token.
 *
 * The app runs the GitHub OAuth dance itself (expo-auth-session) and posts the
 * resulting token here exactly once. We verify it *with GitHub* rather than
 * trusting the caller — the whole security of this endpoint rests on that call,
 * because anyone can POST a string.
 *
 * The same upsert as the web sign-in, so first-time mobile users get the
 * welcome credit on identical terms.
 */
export async function POST(req: Request) {
  let accessToken: string | undefined;
  try {
    ({ accessToken } = (await req.json()) as { accessToken?: string });
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!accessToken) {
    return NextResponse.json({ error: "missing_access_token" }, { status: 400 });
  }

  // Verify against GitHub. A bad token must fail here, not later.
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    return NextResponse.json({ error: "github_rejected_token" }, { status: 401 });
  }

  const profile = (await res.json()) as GithubProfile;
  const user = await upsertGithubUser(profile, accessToken);

  const minted = mintMobileToken(user.id);
  if (!minted) {
    // AUTH_SECRET missing — refuse rather than issue a forgeable token.
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  return NextResponse.json({
    token: minted.token,
    expiresAt: minted.expiresAt,
    user: {
      id: user.id,
      githubLogin: user.githubLogin,
      avatarUrl: profile.avatar_url,
      name: profile.name,
    },
  });
}
