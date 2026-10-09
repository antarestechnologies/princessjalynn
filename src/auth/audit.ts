import { auditLog } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { scrub } from "@/lib/logger";

export interface AuditEntry {
  actorUserId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  ipPrefix?: string | null;
}

/** Append-only. Metadata is scrubbed so PII cannot leak in even by accident. */
export async function recordAudit(db: AppDb, entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    actorUserId: entry.actorUserId ?? null,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? null,
    metadata: entry.metadata ? (scrub(entry.metadata) as Record<string, unknown>) : null,
    ipPrefix: entry.ipPrefix ?? null,
  });
}
