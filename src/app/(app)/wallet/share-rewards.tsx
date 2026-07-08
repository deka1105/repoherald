"use client";

import { useActionState } from "react";
import { submitSocialShare, type ShareState } from "@/app/actions/shares";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PLATFORMS = [
  { value: "reddit", label: "Reddit" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "x", label: "X (Twitter)" },
  { value: "tiktok", label: "TikTok" },
];

export type ShareRow = {
  id: string;
  platform: string;
  url: string;
  status: string;
};

export function ShareRewards({ shares }: { shares: ShareRow[] }) {
  const [state, action, pending] = useActionState<ShareState, FormData>(
    submitSocialShare,
    {}
  );
  const byPlatform = new Map(shares.map((s) => [s.platform, s]));
  const openPlatforms = PLATFORMS.filter(
    (p) => !["pending", "approved"].includes(byPlatform.get(p.value)?.status ?? "")
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Share repoherald (or a listed repo) on social media and earn 1 credit per
        platform. Submit the post URL — an admin reviews it, and the post must stay
        up for 7 days or the credit is taken back.
      </p>
      {openPlatforms.length > 0 && (
        <form action={action} className="flex flex-wrap items-center gap-2">
          <Select name="platform" defaultValue={openPlatforms[0].value}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {openPlatforms.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            name="url"
            placeholder="https://… link to your post"
            className="w-72"
            required
          />
          <Button type="submit" disabled={pending}>
            {pending ? "Submitting…" : "Submit"}
          </Button>
        </form>
      )}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-green-600">{state.success}</p>}
      {shares.length > 0 && (
        <ul className="space-y-1.5">
          {shares.map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-sm">
              <Badge
                variant={
                  s.status === "approved"
                    ? "default"
                    : s.status === "pending"
                      ? "secondary"
                      : "outline"
                }
              >
                {s.status}
              </Badge>
              <span className="capitalize">{s.platform}</span>
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="truncate text-muted-foreground hover:underline"
              >
                {s.url}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
