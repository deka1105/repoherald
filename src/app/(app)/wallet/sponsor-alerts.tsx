"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateSponsorAlerts } from "@/app/actions/notifications";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export function SponsorAlerts({
  optIn,
  hasEmail,
}: {
  optIn: boolean;
  hasEmail: boolean;
}) {
  const [checked, setChecked] = useState(optIn);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Checkbox
          id="sponsor-alerts"
          checked={checked}
          disabled={pending || !hasEmail}
          onCheckedChange={(next) => {
            const value = next === true;
            setChecked(value);
            startTransition(async () => {
              await updateSponsorAlerts(value);
              toast.success(
                value ? "Sponsored-repo alerts on." : "Sponsored-repo alerts off."
              );
            });
          }}
        />
        <Label htmlFor="sponsor-alerts" className="cursor-pointer">
          Email me when a new sponsored repo goes live
        </Label>
      </div>
      {!hasEmail && (
        <p className="text-sm text-muted-foreground">
          Add an email to your GitHub account to receive alerts.
        </p>
      )}
    </div>
  );
}
