import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { upsertGithubUser, type GithubProfile } from "@/lib/github-user";
import { upsertGoogleUser, type GoogleProfile } from "@/lib/google-user";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      authorization: { params: { scope: "read:user user:email" } },
    }),
    // Registered only when configured. Auth.js renders a provider button for
    // everything in this array, and an unconfigured one is a button that leads
    // to a provider error page — worse than no button at all.
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      ? [Google]
      : []),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (!account || !profile) return token;

      if (account.provider === "google") {
        const row = await upsertGoogleUser(profile as unknown as GoogleProfile);
        token.userId = row.id;
        token.role = row.role;
        // Carries the login when Google linked into an account that already had
        // GitHub connected, and null otherwise.
        token.githubLogin = row.githubLogin;
        return token;
      }

      if (account.provider === "github" && account.access_token) {
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
        session.user.githubLogin = (token.githubLogin as string | null) ?? null;
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
      /** NULL when the account has not connected GitHub. */
      githubLogin: string | null;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
