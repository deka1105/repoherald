"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { claimStar } from "@/app/actions/claims";
import { Button } from "@/components/ui/button";

export function ClaimButton({
  repoId,
  alreadyClaimed,
}: {
  repoId: string;
  alreadyClaimed: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [claimed, setClaimed] = useState(alreadyClaimed);

  if (claimed) {
    return (
      <Button disabled variant="secondary">
        <Star className="mr-1 size-4 fill-current" /> Star claimed
      </Button>
    );
  }

  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await claimStar(repoId);
          if (result.error) toast.error(result.error);
          if (result.success) {
            toast.success(result.success);
            setClaimed(true);
          }
        })
      }
    >
      <Star className="mr-1 size-4" />
      {pending ? "Verifying…" : "I starred this — claim credit"}
    </Button>
  );
}
