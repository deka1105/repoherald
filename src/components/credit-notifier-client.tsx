"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { markCreditsSeen } from "@/app/actions/notifications";

export function CreditNotifierClient({
  messages,
  balance,
}: {
  messages: { id: string; text: string; positive: boolean }[];
  balance: number;
}) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    for (const m of messages) {
      if (m.positive) {
        toast.success(m.text, { description: `Balance: ${balance} credits` });
      } else {
        toast.warning(m.text, { description: `Balance: ${balance} credits` });
      }
    }
    void markCreditsSeen();
  }, [messages, balance]);

  return null;
}
