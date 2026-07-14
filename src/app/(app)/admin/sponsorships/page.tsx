import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { repos, sponsorships } from "@/db/schema";
import {
  adminCancelSponsorship,
  adminCreateSponsorship,
} from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminSponsorshipsPage() {
  // Money — admin-only even though the layout admits moderators.
  const session = await auth();
  if (session?.user?.role !== "admin") notFound();
  const [rows, activeRepos] = await Promise.all([
    db
      .select({ s: sponsorships, repoName: repos.fullName })
      .from(sponsorships)
      .innerJoin(repos, eq(sponsorships.repoId, repos.id))
      .orderBy(desc(sponsorships.createdAt))
      .limit(100),
    db
      .select({ id: repos.id, fullName: repos.fullName })
      .from(repos)
      .where(eq(repos.status, "active"))
      .limit(500),
  ]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create sponsorship (manual)</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async (fd) => {
              "use server";
              await adminCreateSponsorship(fd);
            }}
            className="flex flex-wrap items-end gap-3"
          >
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Repo</label>
              <select
                name="repoId"
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                {activeRepos.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Plan</label>
              <select
                name="plan"
                className="h-9 rounded-md border bg-background px-2 text-sm"
                defaultValue="7d"
              >
                <option value="7d">7 days / 75 stars</option>
                <option value="15d">15 days / 160 stars</option>
                <option value="30d">30 days / 350 stars</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Sponsor name
              </label>
              <Input name="sponsorName" placeholder="Acme Corp" className="w-48" />
            </div>
            <Button type="submit" size="sm">
              Create
            </Button>
          </form>
        </CardContent>
      </Card>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Repo</TableHead>
            <TableHead>Sponsor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Window</TableHead>
            <TableHead>Via</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ s, repoName }) => (
            <TableRow key={s.id}>
              <TableCell>{repoName}</TableCell>
              <TableCell>{s.sponsorName ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={s.status === "active" ? "default" : "outline"}>
                  {s.status}
                </Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                {s.startsAt?.toLocaleDateString()} → {s.endsAt?.toLocaleDateString()}
              </TableCell>
              <TableCell>{s.createdVia}</TableCell>
              <TableCell>
                {(s.status === "active" || s.status === "pending_payment") && (
                  <form
                    action={async () => {
                      "use server";
                      await adminCancelSponsorship(s.id);
                    }}
                  >
                    <Button variant="outline" size="sm" type="submit">
                      Cancel
                    </Button>
                  </form>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
