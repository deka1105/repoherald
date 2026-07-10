"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Gift } from "lucide-react";
import { spendOnHighlight } from "@/app/actions/highlights";
import { trackEvent } from "@/lib/track-client";
import { Button } from "@/components/ui/button";

export function DonateButton({ repoId }: { repoId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await spendOnHighlight(repoId, "donation");
          if (result.error) toast.error(result.error);
          if (result.success) toast.success(result.success);
        })
      }
    >
      <Gift className="mr-1 size-4" />
      {pending ? "Donating…" : "Donate 15 min highlight (1 credit)"}
    </Button>
  );
}
