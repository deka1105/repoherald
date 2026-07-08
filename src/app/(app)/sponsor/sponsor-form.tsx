"use client";

import { useActionState } from "react";
import { startSponsorship, type SponsorState } from "@/app/actions/sponsor";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SponsorForm({
  repos,
}: {
  repos: { id: string; fullName: string }[];
}) {
  const [state, action, pending] = useActionState<SponsorState, FormData>(
    startSponsorship,
    {}
  );

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label>Repo</Label>
        <Select name="repoId" defaultValue={repos[0]?.id}>
          <SelectTrigger>
            <SelectValue placeholder="Pick a repo" />
          </SelectTrigger>
          <SelectContent>
            {repos.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Plan (ends at the day limit or star gain, whichever first)</Label>
        <Select name="plan" defaultValue="7d">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">7 days or 75 stars gained</SelectItem>
            <SelectItem value="15d">15 days or 160 stars gained</SelectItem>
            <SelectItem value="30d">30 days or 350 stars gained</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Redirecting to Stripe…" : "Continue to payment"}
      </Button>
    </form>
  );
}
