"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { USERNAME_MAX } from "@/lib/username";
import type { UsernameState } from "@/app/actions/username";

/**
 * Change your handle. Mirrors SocialHandleForm, with one deliberate
 * difference: there is no empty state and no "Claim" — every account arrives
 * here already holding a handle, so the only action is to replace it.
 */
export function UsernameForm({
  current,
  action,
}: {
  current: string;
  action: (prev: UsernameState, fd: FormData) => Promise<UsernameState>;
}) {
  const [state, formAction, pending] = useActionState<UsernameState, FormData>(
    action,
    {}
  );

  return (
    <form action={formAction} className="space-y-2">
      <label htmlFor="username" className="text-sm font-medium">
        Username
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 basis-48 items-center gap-1">
          <span className="text-muted-foreground">@</span>
          <Input
            id="username"
            name="username"
            defaultValue={current}
            maxLength={USERNAME_MAX}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            className="min-w-0"
            aria-describedby="username-rules"
          />
        </div>
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Update"}
        </Button>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.ok && <p className="text-sm text-muted-foreground">{state.ok}</p>}
      <p id="username-rules" className="text-xs text-muted-foreground">
        Letters, numbers, hyphens, underscores and periods — up to{" "}
        {USERNAME_MAX} characters. Two accounts can&apos;t share one, and
        capitalisation isn&apos;t part of it: <code>Octocat</code> and{" "}
        <code>octocat</code> are the same username.
      </p>
    </form>
  );
}
