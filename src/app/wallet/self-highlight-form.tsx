"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { spendOnHighlight } from "@/app/actions/highlights";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SelfHighlightForm({
  repos,
  disabled,
}: {
  repos: { id: string; fullName: string }[];
  disabled: boolean;
}) {
  const [repoId, setRepoId] = useState<string>(repos[0]?.id ?? "");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={repoId} onValueChange={setRepoId}>
        <SelectTrigger className="w-64">
          <SelectValue placeholder="Pick your repo" />
        </SelectTrigger>
        <SelectContent>
          {repos.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {r.fullName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        disabled={disabled || pending || !repoId}
        onClick={() =>
          startTransition(async () => {
            const result = await spendOnHighlight(repoId, "self");
            if (result.error) toast.error(result.error);
            if (result.success) toast.success(result.success);
          })
        }
      >
        {pending ? "Queueing…" : "Highlight for 1 hour (1 credit)"}
      </Button>
    </div>
  );
}
