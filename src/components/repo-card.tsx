import Link from "next/link";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export type RepoCardData = {
  id: string;
  fullName: string;
  description: string | null;
  primaryLanguage: string | null;
  starsCount: number;
  avatarUrl: string | null;
  isArchived: boolean;
  categoryLabels?: string[];
  highlighted?: boolean;
  sponsored?: boolean;
};

export function RepoCard({ repo }: { repo: RepoCardData }) {
  return (
    <Card
      className={
        repo.highlighted || repo.sponsored ? "border-amber-400/60 bg-amber-50/40 dark:bg-amber-950/10" : undefined
      }
    >
      <CardContent className="flex items-start gap-3 p-4">
        <Avatar className="mt-0.5 size-9">
          <AvatarImage src={repo.avatarUrl ?? undefined} />
          <AvatarFallback>{repo.fullName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/repos/${repo.id}`}
              className="truncate font-medium hover:underline"
            >
              {repo.fullName}
            </Link>
            {repo.sponsored && <Badge variant="secondary">Sponsored</Badge>}
            {repo.highlighted && !repo.sponsored && (
              <Badge className="bg-amber-500 text-white hover:bg-amber-500">
                Highlighted
              </Badge>
            )}
            {repo.isArchived && <Badge variant="outline">Archived</Badge>}
          </div>
          {repo.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {repo.description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Star className="size-3" /> {repo.starsCount.toLocaleString()}
            </span>
            {repo.primaryLanguage && <span>{repo.primaryLanguage}</span>}
            {repo.categoryLabels?.map((label) => (
              <Badge key={label} variant="outline" className="font-normal">
                {label}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
