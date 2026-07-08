"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SEEN_KEY = "rh_welcome_seen";
const SEEN_EVENT = "rh-welcome-change";

function subscribeSeen(cb: () => void) {
  window.addEventListener(SEEN_EVENT, cb);
  return () => window.removeEventListener(SEEN_EVENT, cb);
}

function markSeen() {
  localStorage.setItem(SEEN_KEY, "1");
  window.dispatchEvent(new Event(SEEN_EVENT));
}

const STEPS = [
  {
    title: "Star repos to earn credits",
    body: "Star any listed repo on GitHub — a verified star mints you 1 credit.",
  },
  {
    title: "Post your own repo",
    body: "Add a repo you own so others can discover and star it.",
  },
  {
    title: "Boost it",
    body: "Spend 1 credit to highlight your repo for an hour in the feed.",
  },
];

/**
 * One-time welcome modal for a logged-in user's first visit. "Seen" lives in
 * localStorage (same lightweight pattern as the landing sponsor panel): SSR
 * renders it closed, and it opens after hydration only if not previously seen.
 * Dismissal is per-device and permanent — no server round-trip.
 */
export function WelcomeGuide() {
  const router = useRouter();
  const open = !useSyncExternalStore(
    subscribeSeen,
    () => localStorage.getItem(SEEN_KEY) === "1",
    () => true
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) markSeen();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Welcome to repoherald 👋</DialogTitle>
          <DialogDescription>Three steps to your first highlight.</DialogDescription>
        </DialogHeader>

        <ol className="space-y-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex items-start gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-amber-50 text-sm font-semibold text-amber-700 ring-1 ring-amber-200">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-sm text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <DialogFooter>
          <Button variant="outline" onClick={markSeen}>
            Skip for now
          </Button>
          <Button
            onClick={() => {
              markSeen();
              router.push("/");
            }}
          >
            Get started
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
