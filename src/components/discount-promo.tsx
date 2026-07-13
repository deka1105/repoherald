"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Tag } from "lucide-react";
import type { AvailableDiscount } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SEEN_KEY = "rh_promo_seen";
const SEEN_EVENT = "rh-promo-change";
// Don't stack on top of the first-run welcome modal.
const WELCOME_KEY = "rh_welcome_seen";

function subscribe(cb: () => void) {
  window.addEventListener(SEEN_EVENT, cb);
  window.addEventListener("rh-welcome-change", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(SEEN_EVENT, cb);
    window.removeEventListener("rh-welcome-change", cb);
    window.removeEventListener("storage", cb);
  };
}

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/**
 * Shows a one-time dialog after login when the user has usable discount codes.
 * "Seen" is keyed on the exact set of codes (localStorage), so a newly added
 * code re-opens it; an unchanged set stays dismissed. Suppressed until the
 * first-run welcome modal has been dismissed so the two never stack.
 */
export function DiscountPromo({ codes }: { codes: AvailableDiscount[] }) {
  const router = useRouter();
  // Stable signature of the available codes.
  const signature = codes.map((c) => c.code).join("|");

  const snapshot = useSyncExternalStore(
    subscribe,
    () =>
      `${localStorage.getItem(WELCOME_KEY) === "1" ? "1" : "0"}:${
        localStorage.getItem(SEEN_KEY) ?? ""
      }`,
    () => "0:"
  );
  const [welcomeSeen, seenSig] = [snapshot.startsWith("1:"), snapshot.slice(2)];

  const open = codes.length > 0 && welcomeSeen && seenSig !== signature;

  function dismiss() {
    localStorage.setItem(SEEN_KEY, signature);
    window.dispatchEvent(new Event(SEEN_EVENT));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="size-5 text-amber-600" />
            {codes.length === 1 ? "You have a discount" : "You have discounts"}
          </DialogTitle>
          <DialogDescription>
            Use {codes.length === 1 ? "this code" : "one of these codes"} at checkout
            when you sponsor a repo.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2">
          {codes.map((c) => (
            <li
              key={c.code}
              className="flex items-center justify-between gap-3 rounded-md border p-3"
            >
              <div>
                <p className="font-mono text-sm font-semibold tracking-wide">
                  {c.code}
                </p>
                <p className="text-xs text-muted-foreground">
                  {c.description}
                  {c.userScoped && " · just for you"}
                  {c.minCents != null && ` · min ${money(c.minCents)}`}
                  {c.expiresAt &&
                    ` · until ${new Date(c.expiresAt).toISOString().slice(0, 10)}`}
                </p>
                {c.note && (
                  <p className="text-xs text-muted-foreground">{c.note}</p>
                )}
              </div>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={dismiss}>
            Maybe later
          </Button>
          <Button
            onClick={() => {
              dismiss();
              router.push("/promote");
            }}
          >
            Sponsor a repo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
