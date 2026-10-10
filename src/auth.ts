import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { upsertGithubUser, type GithubProfile } from "@/lib/github-user";

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
        // Shared with the mobile sign-in path — see src/lib/github-user.ts.
        const row = await upsertGithubUser(
          profile as unknown as GithubProfile,
          account.access_token
        );
        token.userId = row.id;
        token.role = row.role;
        token.githubLogin = row.githubLogin;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
        // Fallback for JWTs minted before the role column existed, so admins
        // keep access without a forced re-sign-in.
        session.user.role =
          (token.role as UserRole | undefined) ??
          (token.isAdmin ? "admin" : "user");
        // Deprecated: only for the root-owned (app) route files that can't be
        // edited yet (see AGENTS.md /sponsor precedent). Use role instead.
        session.user.isAdmin = session.user.role === "admin";
        session.user.githubLogin = token.githubLogin as string;
      }
      return session;
    },
  },
});

export type UserRole = "user" | "moderator" | "admin";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      /** @deprecated use role — kept for root-owned (app) route files. */
      isAdmin: boolean;
      githubLogin: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
