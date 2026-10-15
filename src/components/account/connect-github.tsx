"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { syncGithubFromClerk, type LinkState } from "@/app/actions/github-link";

/**
 * Connect a GitHub account to a login that was created with Google or email.
 *
 * Clerk owns the OAuth dance; this only starts it and then asks the server to
 * copy the result onto our row. `justConnected` is read from the query string
 * by the page (a server component) rather than by useSearchParams here, which
 * keeps this component out of a Suspense boundary.
 */
export function ConnectGithub({
  githubLogin,
  justConnected,
}: {
  githubLogin: string | null;
  justConnected: boolean;
}) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [state, setState] = useState<LinkState>({});
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!justConnected) return;
    start(async () => {
      setState(await syncGithubFromClerk());
      // Drop the marker so a refresh doesn't re-run the sync.
      router.replace("/account");
      router.refresh();
    });
  }, [justConnected, router]);

  async function connect() {
    if (!user) return;
    setState({});
    try {
      const res = await user.createExternalAccount({
        strategy: "oauth_github",
        redirectUrl: `${window.location.origin}/account?github=connected`,
      });
      const url = res.verification?.externalVerificationRedirectURL;
      if (!url) {
        setState({
          error:
            "Clerk didn't return a GitHub redirect — the GitHub connection is " +
            "probably not enabled on the Clerk instance yet.",
        });
        return;
      }
      window.location.href = url.toString();
    } catch (e) {
      setState({
        error: e instanceof Error ? e.message : "Couldn't start the connection.",
      });
    }
  }

  if (githubLogin) {
    return (
      <div className="space-y-1">
        <p className="text-sm">
          Connected as <strong>@{githubLogin}</strong>.
        </p>
        <p className="text-xs text-muted-foreground">
          This is what lets you post your own repos and earn credits for
          verified stars. Manage or remove it from your Clerk profile.
        </p>
        {state.ok && <p className="text-sm text-muted-foreground">{state.ok}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={connect}
        disabled={!isLoaded || pending}
      >
        {pending ? "Connecting…" : "Connect GitHub"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Optional. You only need it to post your own repositories or to earn
        credits for stars — everything else works without it.
      </p>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.ok && <p className="text-sm text-muted-foreground">{state.ok}</p>}
    </div>
  );
}
