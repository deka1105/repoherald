import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { encryptToken } from "@/lib/crypto";
import { grantWelcomeCredit } from "@/lib/credits";

type GithubProfile = {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  created_at: string;
  public_repos: number;
  followers: number;
};

// Eligibility heuristic against throwaway accounts: 90+ days old, or 30+ days
// with a real footprint (3+ public repos and 2+ followers).
function computeMintEligible(p: GithubProfile): boolean {
  const ageDays = (Date.now() - new Date(p.created_at).getTime()) / 86_400_000;
  if (ageDays >= 90) return true;
  return ageDays >= 30 && p.public_repos >= 3 && p.followers >= 2;
}

function bootstrapAdminLogins(): Set<string> {
  return new Set(
    (process.env.ADMIN_GITHUB_LOGINS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      authorization: { params: { scope: "read:user user:email" } },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.access_token && profile) {
        const p = profile as unknown as GithubProfile;
        const isBootstrapAdmin = bootstrapAdminLogins().has(p.login.toLowerCase());
        const values = {
          githubLogin: p.login,
          name: p.name,
          email: p.email,
          avatarUrl: p.avatar_url,
          githubAccessTokenEnc: encryptToken(account.access_token),
          tokenInvalidAt: null,
          githubCreatedAt: new Date(p.created_at),
          githubPublicRepos: p.public_repos,
          githubFollowers: p.followers,
          mintEligible: computeMintEligible(p),
        };
        const [row] = await db
          .insert(users)
          .values({
            ...values,
            githubId: p.id,
            role: isBootstrapAdmin ? "admin" : "user",
          })
          .onConflictDoUpdate({
            target: users.githubId,
            // Non-bootstrap sign-ins leave role untouched so moderators and
            // dashboard-granted admins aren't demoted on their next sign-in.
            set: isBootstrapAdmin ? { ...values, role: "admin" } : values,
          })
          // xmax = 0 marks a freshly inserted row (vs. an ON CONFLICT update),
          // so the welcome bonus fires exactly once, on first sign-in.
          .returning({
            id: users.id,
            role: users.role,
            isNew: sql<boolean>`(xmax = 0)`,
          });
        token.userId = row.id;
        token.role = row.role;
        token.githubLogin = p.login;
        if (row.isNew && values.mintEligible) {
          await grantWelcomeCredit(row.id);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
        session.user.isAdmin = Boolean(token.isAdmin);
        session.user.githubLogin = token.githubLogin as string;
      }
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isAdmin: boolean;
      githubLogin: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
