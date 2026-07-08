import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { supportTickets, users } from "@/db/schema";
import { setSupportTicketStatus } from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminSupportPage() {
  const rows = await db
    .select({ ticket: supportTickets, login: users.githubLogin })
    .from(supportTickets)
    .leftJoin(users, eq(supportTickets.userId, users.id))
    .orderBy(desc(supportTickets.createdAt))
    .limit(200);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Messages submitted from the Support page. Reply by email, then mark resolved.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>From</TableHead>
            <TableHead>Message</TableHead>
            <TableHead>Received</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-sm text-muted-foreground">
                No support messages yet.
              </TableCell>
            </TableRow>
          ) : (
            rows.map(({ ticket, login }) => (
              <TableRow key={ticket.id} className="align-top">
                <TableCell className="whitespace-nowrap">
                  <a
                    href={`mailto:${ticket.email}`}
                    className="text-sm hover:underline"
                  >
                    {ticket.email}
                  </a>
                  {login && (
                    <div className="text-xs text-muted-foreground">@{login}</div>
                  )}
                </TableCell>
                <TableCell className="max-w-md">
                  {ticket.subject && (
                    <div className="text-sm font-medium">{ticket.subject}</div>
                  )}
                  <div className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {ticket.message}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {ticket.createdAt.toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Badge variant={ticket.status === "open" ? "secondary" : "outline"}>
                    {ticket.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <form
                    action={async () => {
                      "use server";
                      await setSupportTicketStatus(
                        ticket.id,
                        ticket.status === "open" ? "resolved" : "open"
                      );
                    }}
                  >
                    <Button
                      size="sm"
                      variant={ticket.status === "open" ? "default" : "outline"}
                      type="submit"
                    >
                      {ticket.status === "open" ? "Resolve" : "Reopen"}
                    </Button>
                  </form>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
