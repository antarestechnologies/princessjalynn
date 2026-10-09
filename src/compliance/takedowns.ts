import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { recordAudit } from "@/auth/audit";
import { takedownRequests } from "@/db/schema";
import type { AppDb } from "@/db/types";

export const relationships = [
  "copyright_owner",
  "depicted_person",
  "authorized_agent",
  "other",
] as const;

export const takedownInputSchema = z.object({
  reporterName: z.string().trim().min(2, "Enter your name").max(200),
  reporterEmail: z.string().trim().email("Enter a valid email").max(254),
  reporterRelationship: z.enum(relationships),
  contentUrls: z
    .string()
    .max(5000)
    .transform((v) =>
      v
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .pipe(
      z
        .array(z.string().url("Each line must be a full URL").max(2000))
        .min(1, "List at least one URL")
        .max(50),
    ),
  description: z.string().trim().min(10, "Describe the problem").max(10000),
  goodFaithAttested: z.literal(true, { message: "Confirm the statement to submit" }),
});
export type TakedownInput = z.infer<typeof takedownInputSchema>;

export async function submitTakedown(
  db: AppDb,
  input: TakedownInput,
  meta: { ipPrefix?: string | null } = {},
) {
  const [row] = await db
    .insert(takedownRequests)
    .values({
      reporterName: input.reporterName,
      reporterEmail: input.reporterEmail,
      reporterRelationship: input.reporterRelationship,
      contentUrls: input.contentUrls,
      description: input.description,
      goodFaithAttested: input.goodFaithAttested,
    })
    .returning({ id: takedownRequests.id });
  // No reporter PII in the audit row; the request itself is admin-only.
  await recordAudit(db, {
    action: "takedown.submitted",
    targetType: "takedown",
    targetId: row.id,
    metadata: { urls: input.contentUrls.length, relationship: input.reporterRelationship },
    ipPrefix: meta.ipPrefix,
  });
  return row.id;
}

export async function listTakedowns(db: AppDb) {
  return db.query.takedownRequests.findMany({ orderBy: [desc(takedownRequests.createdAt)] });
}

export async function getTakedown(db: AppDb, id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  return (
    (await db.query.takedownRequests.findFirst({ where: eq(takedownRequests.id, id) })) ?? null
  );
}

export const takedownUpdateSchema = z.object({
  status: z.enum(["new", "reviewing", "actioned", "rejected"]),
  resolutionNotes: z.string().trim().max(10000).optional().or(z.literal("")),
  assignToMe: z.boolean().default(false),
});

export async function updateTakedown(
  db: AppDb,
  actorId: string,
  id: string,
  input: z.input<typeof takedownUpdateSchema>,
) {
  const parsed = takedownUpdateSchema.parse(input);
  const closed = parsed.status === "actioned" || parsed.status === "rejected";
  const now = new Date();
  const rows = await db
    .update(takedownRequests)
    .set({
      status: parsed.status,
      resolutionNotes: parsed.resolutionNotes || null,
      resolvedAt: closed ? now : null,
      ...(parsed.assignToMe ? { assignedToUserId: actorId } : {}),
      updatedAt: now,
    })
    .where(eq(takedownRequests.id, id))
    .returning({ id: takedownRequests.id });
  if (rows.length)
    await recordAudit(db, {
      actorUserId: actorId,
      action: `takedown.${parsed.status}`,
      targetType: "takedown",
      targetId: id,
    });
  return rows.length > 0;
}
