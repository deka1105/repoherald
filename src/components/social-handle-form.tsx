"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { HandleState } from "@/app/actions/social-handles";

export function SocialHandleForm({
  label,
  name,
  current,
  listSlug,
  action,
}: {
  label: string;
  name: string;
  current: string | null;
  /** Link to the private list, once one exists. */
  listSlug: string | null;
  action: (prev: HandleState, fd: FormData) => Promise<HandleState>;
}) {
  const [state, formAction, pending] = useActionState<HandleState, FormData>(
    action,
    {}
  );

  return (
    <form action={formAction} className="space-y-2">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 basis-48 items-center gap-1">
          <span className="text-muted-foreground">@</span>
          <Input
            id={name}
            name="handle"
            defaultValue={current ?? ""}
            placeholder="yourhandle"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0"
          />
        </div>
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : current ? "Update" : "Claim"}
        </Button>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.ok && <p className="text-sm text-muted-foreground">{state.ok}</p>}
      {current && listSlug && (
        <p className="text-xs text-muted-foreground">
          Finds are filed into{" "}
          <Link href={`/lists/${listSlug}`} className="underline underline-offset-2">
            your private list
          </Link>
          . Clearing the field removes the handle and leaves the list alone.
        </p>
      )}
    </form>
  );
}
