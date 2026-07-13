// Shared (server- and client-safe) presentational price. When a plan is on
// sale, the original price is shown with a red diagonal strikethrough and the
// reduced price in green; otherwise just the price.

function money(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

/** Reduced price after a whole-percent plan discount (rounded to the cent). */
export function discountedCents(amountCents: number, discountPercent: number): number {
  if (!discountPercent || discountPercent <= 0) return amountCents;
  const pct = Math.min(100, Math.max(0, discountPercent));
  return Math.max(0, Math.round((amountCents * (100 - pct)) / 100));
}

export function PlanPrice({
  amountCents,
  discountPercent = 0,
  currency = "usd",
  className = "",
}: {
  amountCents: number;
  discountPercent?: number;
  currency?: string;
  className?: string;
}) {
  const final = discountedCents(amountCents, discountPercent);
  const onSale = discountPercent > 0 && final < amountCents;

  if (!onSale) {
    return <span className={className}>{money(amountCents, currency)}</span>;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className="text-red-500"
        // Red diagonal line (bottom-left → top-right) drawn across the text.
        style={{
          backgroundImage:
            "linear-gradient(to top right, transparent calc(50% - 0.75px), currentColor calc(50% - 0.75px), currentColor calc(50% + 0.75px), transparent calc(50% + 0.75px))",
        }}
      >
        {money(amountCents, currency)}
      </span>
      <span className="font-semibold text-green-600 dark:text-green-400">
        {money(final, currency)}
      </span>
    </span>
  );
}
