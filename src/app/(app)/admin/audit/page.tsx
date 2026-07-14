import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { auditLog, users } from "@/db/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminAuditPage() {
  const rows = await db
    .select({ entry: auditLog, actorLogin: users.githubLogin })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.actorUserId, users.id))
    .orderBy(desc(auditLog.createdAt))
    .limit(200);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>When</TableHead>
          <TableHead>Actor</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Entity</TableHead>
          <TableHead>Details</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ entry, actorLogin }) => (
          <TableRow key={entry.id}>
            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
              {entry.createdAt.toLocaleString()}
            </TableCell>
            <TableCell>
              {actorLogin ?? entry.actorType}
              <span className="ml-1 text-xs text-muted-foreground">
                ({entry.actorType})
              </span>
            </TableCell>
            <TableCell className="font-mono text-xs">{entry.action}</TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {entry.entityType} {entry.entityId?.slice(0, 8)}
            </TableCell>
            <TableCell className="max-w-64 truncate text-xs text-muted-foreground">
              {entry.metadata ? JSON.stringify(entry.metadata) : ""}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
