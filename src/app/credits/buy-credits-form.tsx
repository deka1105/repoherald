"use client";

import { useActionState } from "react";
import { startCreditPurchase, type BuyCreditsState } from "@/app/actions/buy-credits";
import { PlanPrice, discountedCents } from "@/components/plan-price";
import { Button } from "@/components/ui/button";

export type PackOption = {
  key: string;
  label: string;
  credits: number;
  amountCents: number;
  discountPercent: number;
  currency: string;
};

function perCredit(cents: number, credits: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format(cents / credits / 100);
}

export function BuyCreditsForm({ packs }: { packs: PackOption[] }) {
  const [state, action, pending] = useActionState<BuyCreditsState, FormData>(
    startCreditPurchase,
    {}
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {packs.map((p) => {
          const final = discountedCents(p.amountCents, p.discountPercent);
          return (
            <form
              key={p.key}
              action={action}
              className="flex flex-col justify-between gap-3 rounded-lg border p-4"
            >
              <input type="hidden" name="pack" value={p.key} />
              <div className="space-y-1">
                <p className="text-sm font-medium">{p.label}</p>
                <p className="text-2xl font-semibold">
                  {p.credits}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    credits
                  </span>
                </p>
                <PlanPrice
                  amountCents={p.amountCents}
                  discountPercent={p.discountPercent}
                  currency={p.currency}
                />
                <p className="text-xs text-muted-foreground">
                  {perCredit(final, p.credits, p.currency)} per credit
                </p>
              </div>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Redirecting…" : "Buy"}
              </Button>
            </form>
          );
        })}
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </div>
  );
}
