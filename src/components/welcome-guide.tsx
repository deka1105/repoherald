"use client";

import { useEffect, useState } from "react";
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
 * One-time welcome modal shown to a logged-in user on first visit. "Seen" is
 * tracked in localStorage (same lightweight pattern as the landing sponsor
 * panel) — no server round-trip, dismissal is per-device and permanent.
 */
export function WelcomeGuide() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {
      // localStorage unavailable (private mode / SSR) — just don't show it.
    }
  }, []);

  const markSeen = () => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const dismiss = () => {
    markSeen();
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
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
          <Button variant="outline" onClick={dismiss}>
            Skip for now
          </Button>
          <Button
            onClick={() => {
              dismiss();
              router.push("/post");
            }}
          >
            Get started
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
