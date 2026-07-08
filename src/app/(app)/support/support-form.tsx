"use client";

import { useActionState } from "react";
import { submitSupportTicket, type SupportState } from "@/app/actions/support";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function SupportForm({ email }: { email: string | null }) {
  const [state, action, pending] = useActionState<SupportState, FormData>(
    submitSupportTicket,
    {}
  );

  if (state.success) {
    return <p className="text-sm text-green-600">{state.success}</p>;
  }

  return (
    <form action={action} className="space-y-4">
      {email ? (
        <p className="text-sm text-muted-foreground">
          We&apos;ll reply to <span className="font-medium">{email}</span>.
        </p>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="email">Your email</Label>
          <Input id="email" name="email" type="email" placeholder="you@example.com" required />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="subject">Subject (optional)</Label>
        <Input id="subject" name="subject" placeholder="What's this about?" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="message">How can we help?</Label>
        <Textarea
          id="message"
          name="message"
          rows={6}
          placeholder="Describe your question or issue…"
          required
        />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
