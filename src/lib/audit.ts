import { auditLog } from "@/db/schema";
import type { Db, Tx } from "@/db";

type AuditInput = {
  actorUserId?: string | null;
  actorType: "user" | "admin" | "system" | "stripe";
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

export async function writeAudit(dbOrTx: Db | Tx, input: AuditInput) {
  await dbOrTx.insert(auditLog).values({
    actorUserId: input.actorUserId ?? null,
    actorType: input.actorType,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: input.metadata,
  });
}
