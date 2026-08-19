"use client";

import { useActionState } from "react";
import { ExternalLink } from "lucide-react";
import {
  submitIssueReport,
  type IssueReportState,
} from "@/app/actions/issue-reports";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Two-step by nature: the issue is opened on GitHub, then its URL is claimed
 * here. Credits stay pending until the validation window closes. */
export function ReportIssue({
  repoId,
  fullName,
  credits,
  validationDays,
}: {
  repoId: string;
  fullName: string;
  credits: number;
  validationDays: number;
}) {
  const [state, action, pending] = useActionState<IssueReportState, FormData>(
    submitIssueReport,
    {}
  );

  return (
    <details className="rounded-md border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        Report an issue — earn {credits} credits
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-muted-foreground">
          Open the issue on GitHub first, then paste its link here. The credits
          stay pending for {validationDays} days and land only if the issue
          isn&apos;t labelled invalid, duplicate, or similar.
        </p>
        <Button asChild variant="outline" size="sm">
          <a
            href={`https://github.com/${fullName}/issues/new`}
            target="_blank"
            rel="noreferrer"
          >
            Open an issue on GitHub <ExternalLink className="ml-1 size-3.5" />
          </a>
        </Button>
        <form action={action} className="flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="repoId" value={repoId} />
          <Input
            name="issueUrl"
            placeholder={`github.com/${fullName}/issues/123`}
            aria-label="Issue link"
            required
            className="sm:flex-1"
          />
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Checking…" : "Claim"}
          </Button>
        </form>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        {state.success && <p className="text-sm text-green-600">{state.success}</p>}
      </div>
    </details>
  );
}
