"use client";

import { useActionState } from "react";
import { postRepo, type PostRepoState } from "@/app/actions/repos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

type Category = { id: string; label: string };

function CategoryGroup({
  title,
  hint,
  items,
}: {
  title: string;
  hint: string;
  items: Category[];
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">
        {title} <span className="font-normal text-muted-foreground">({hint})</span>
      </legend>
      <div className="grid grid-cols-2 gap-2">
        {items.map((c) => (
          <label key={c.id} className="flex items-center gap-2 text-sm">
            <Checkbox name="categoryIds" value={c.id} />
            {c.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function PostRepoForm({
  useCases,
  sectors,
}: {
  useCases: Category[];
  sectors: Category[];
}) {
  const [state, action, pending] = useActionState<PostRepoState, FormData>(
    postRepo,
    {}
  );

  return (
    <form action={action} className="mt-6 space-y-6">
      <div className="space-y-2">
        <Label htmlFor="url">GitHub repo URL</Label>
        <Input
          id="url"
          name="url"
          placeholder="https://github.com/owner/name"
          required
        />
      </div>
      <CategoryGroup title="Use cases" hint="up to 3" items={useCases} />
      <CategoryGroup title="Sectors" hint="up to 3" items={sectors} />
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Validating…" : "Post repo"}
      </Button>
    </form>
  );
}
