import { asc } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { createCategory, toggleCategory } from "@/app/actions/admin";
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

export default async function AdminCategoriesPage() {
  const cats = await db
    .select()
    .from(categories)
    .orderBy(asc(categories.kind), asc(categories.label));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add category</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async (fd) => {
              "use server";
              await createCategory(fd);
            }}
            className="flex flex-wrap items-end gap-3"
          >
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Kind</label>
              <select
                name="kind"
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="use_case">Use case</option>
                <option value="sector">Sector</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Label</label>
              <Input name="label" placeholder="e.g. Gaming" className="w-48" />
            </div>
            <Button type="submit" size="sm">
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Label</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {cats.map((c) => (
            <TableRow key={c.id}>
              <TableCell>{c.label}</TableCell>
              <TableCell>{c.kind === "use_case" ? "Use case" : "Sector"}</TableCell>
              <TableCell className="text-muted-foreground">{c.slug}</TableCell>
              <TableCell>
                <Badge variant={c.isActive ? "default" : "outline"}>
                  {c.isActive ? "active" : "inactive"}
                </Badge>
              </TableCell>
              <TableCell>
                <form
                  action={async () => {
                    "use server";
                    await toggleCategory(c.id, !c.isActive);
                  }}
                >
                  <Button variant="outline" size="sm" type="submit">
                    {c.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </form>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
