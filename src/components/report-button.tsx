"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Flag } from "lucide-react";
import { reportRepo } from "@/app/actions/repos";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ReportButton({ repoId }: { repoId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Flag className="mr-1 size-3.5" /> Report
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report this listing</DialogTitle>
        </DialogHeader>
        <Textarea
          placeholder="What's wrong with this listing? (spam, malware, misleading, …)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
        />
        <DialogFooter>
          <Button
            disabled={pending || reason.trim().length < 5}
            onClick={() =>
              startTransition(async () => {
                await reportRepo(repoId, reason.trim());
                toast.success("Report sent — an admin will take a look.");
                setReason("");
                setOpen(false);
              })
            }
          >
            {pending ? "Sending…" : "Send report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
