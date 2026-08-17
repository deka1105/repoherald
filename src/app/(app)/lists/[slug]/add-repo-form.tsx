"use client";

import { useActionState } from "react";
import { addRepoToList, type ListFormState } from "@/app/actions/lists";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NOTE_MAX } from "@/lib/lists";

export function AddRepoForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState<ListFormState, FormData>(
    addRepoToList,
    {}
  );

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="slug" value={slug} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          name="repo"
          placeholder="github.com/owner/name"
          aria-label="GitHub repo"
          required
          className="sm:flex-1"
        />
        <Input
          name="note"
          placeholder="Why it belongs here (optional)"
          aria-label="Note"
          maxLength={NOTE_MAX}
          className="sm:flex-1"
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add"}
        </Button>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-600">{state.ok}</p>}
    </form>
  );
}
