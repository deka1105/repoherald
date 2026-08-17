"use client";

import { useActionState } from "react";
import { createList, type ListFormState } from "@/app/actions/lists";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DESCRIPTION_MAX, TITLE_MAX } from "@/lib/lists";

export function CreateListForm() {
  const [state, action, pending] = useActionState<ListFormState, FormData>(
    createList,
    {}
  );

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">List name</Label>
        <Input
          id="title"
          name="title"
          placeholder="e.g. Rust CLI tools worth starring"
          maxLength={TITLE_MAX}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          name="description"
          rows={2}
          maxLength={DESCRIPTION_MAX}
          placeholder="What belongs in this list?"
        />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create list"}
      </Button>
    </form>
  );
}
