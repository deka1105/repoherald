"use client";

import { useActionState, useState } from "react";
import { startPromotion, type PromoteState } from "@/app/actions/promote";
import { PlanPrice } from "@/components/plan-price";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PlanOption = {
  key: string;
  label: string;
  amountCents: number;
  discountPercent: number;
  currency: string;
};

export function PromoteForm({
  repos,
  plans,
}: {
  repos: { id: string; fullName: string }[];
  plans: PlanOption[];
}) {
  const [state, action, pending] = useActionState<PromoteState, FormData>(
    startPromotion,
    {}
  );
  const [planKey, setPlanKey] = useState(plans[0]?.key ?? "");
  const selected = plans.find((p) => p.key === planKey) ?? plans[0];

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
        <Select name="plan" value={planKey} onValueChange={setPlanKey}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {plans.map((p) => (
              <SelectItem key={p.key} value={p.key}>
                <span className="flex items-center gap-2">
                  {p.label} —{" "}
                  <PlanPrice
                    amountCents={p.amountCents}
                    discountPercent={p.discountPercent}
                    currency={p.currency}
                  />
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="discountCode">Discount code (optional)</Label>
        <Input
          id="discountCode"
          name="discountCode"
          placeholder="e.g. LAUNCH20"
          autoCapitalize="characters"
          autoComplete="off"
          className="uppercase"
        />
        <p className="text-xs text-muted-foreground">
          Any discount is applied on the Stripe payment page before you pay.
        </p>
      </div>

      {selected && (
        <p className="text-sm">
          <span className="text-muted-foreground">You&apos;ll pay: </span>
          <PlanPrice
            amountCents={selected.amountCents}
            discountPercent={selected.discountPercent}
            currency={selected.currency}
          />
          {selected.discountPercent > 0 && (
            <span className="ml-1 text-xs text-green-600 dark:text-green-400">
              ({selected.discountPercent}% off)
            </span>
          )}
        </p>
      )}

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Redirecting…" : "Continue to payment"}
      </Button>
    </form>
  );
}
