"use client";

import { useState, useTransition } from "react";
import { resubscribeSponsorAlerts } from "@/app/actions/notifications";

/** Undo, for the case where a mail scanner followed the link, not a person. */
export function ResubscribeButton({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);

  if (done) return <span className="text-sm text-muted-foreground">Sponsor alerts are back on.</span>;

  return (
    <button
      type="button"
      disabled={pending || !token}
      onClick={() =>
        start(async () => {
          const ok = await resubscribeSponsorAlerts(token);
          if (ok) setDone(true);
        })
      }
      className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {pending ? "Turning back on…" : "Undo — resubscribe me"}
    </button>
  );
}
