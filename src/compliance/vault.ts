import { randomUUID } from "node:crypto";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { recordAudit } from "@/auth/audit";
import { media, mediaPerformers, performers, posts, vaultDocuments } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { decryptBlob, encryptBlob, sha256Hex, type VaultKeyring } from "./vault-crypto";

/**
 * Admin-only 2257 vault. Every function that reveals vault contents writes an audit row
 * BEFORE returning data, so there is no read path that skips the log (PLAN.md Phase 5).
 * Nothing here logs PII; audit metadata carries ids and counts only.
 */

export const idTypes = ["passport", "drivers_license", "state_id", "national_id", "other"] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const performerPiiSchema = z.object({
  legalName: z.string().trim().min(2).max(200),
  aliases: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  dateOfBirth: isoDate,
  idType: z.enum(idTypes),
  idNumber: z.string().trim().min(2).max(100),
  idIssuer: z.string().trim().min(2).max(200),
  idExpiration: isoDate
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
});
export type PerformerPii = z.infer<typeof performerPiiSchema>;

export const performerInputSchema = z.object({
  stageName: z.string().trim().min(1).max(100),
  pii: performerPiiSchema,
});

export interface Actor {
  userId: string;
  ipPrefix?: string | null;
}

const ctxPerformer = (id: string) => `performer:${id}`;
const ctxDocument = (id: string, performerId: string) => `document:${id}:performer:${performerId}`;

export function ageOn(dateOfBirth: string, on: string): number {
  const [by, bm, bd] = dateOfBirth.split("-").map(Number);
  const [oy, om, od] = on.split("-").map(Number);
  let age = oy - by;
  if (om < bm || (om === bm && od < bd)) age--;
  return age;
}

const todayIso = (now: Date) => now.toISOString().slice(0, 10);

// ---------- performers ----------
export async function createPerformer(
  db: AppDb,
  kr: VaultKeyring,
  actor: Actor,
  input: z.input<typeof performerInputSchema>,
) {
  const parsed = performerInputSchema.parse(input);
  const id = randomUUID();
  const { blob, keyVersion } = encryptBlob(
    kr,
    Buffer.from(JSON.stringify(parsed.pii)),
    ctxPerformer(id),
  );
  await db
    .insert(performers)
    .values({ id, stageName: parsed.stageName, piiCiphertext: blob, keyVersion });
  await recordAudit(db, {
    actorUserId: actor.userId,
    action: "vault.performer.create",
    targetType: "performer",
    targetId: id,
    ipPrefix: actor.ipPrefix,
  });
  return id;
}

export async function updatePerformer(
  db: AppDb,
  kr: VaultKeyring,
  actor: Actor,
  id: string,
  input: z.input<typeof performerInputSchema>,
) {
  const parsed = performerInputSchema.parse(input);
  const { blob, keyVersion } = encryptBlob(
    kr,
    Buffer.from(JSON.stringify(parsed.pii)),
    ctxPerformer(id),
  );
  const rows = await db
    .update(performers)
    .set({ stageName: parsed.stageName, piiCiphertext: blob, keyVersion, updatedAt: new Date() })
    .where(eq(performers.id, id))
    .returning({ id: performers.id });
  if (rows.length)
    await recordAudit(db, {
      actorUserId: actor.userId,
      action: "vault.performer.update",
      targetType: "performer",
      targetId: id,
      ipPrefix: actor.ipPrefix,
    });
  return rows.length > 0;
}

function decryptPii(kr: VaultKeyring, row: typeof performers.$inferSelect): PerformerPii {
  return performerPiiSchema.parse(
    JSON.parse(
      decryptBlob(kr, row.piiCiphertext, row.keyVersion, ctxPerformer(row.id)).toString("utf8"),
    ),
  );
}

export async function listPerformers(db: AppDb, actor: Actor) {
  await recordAudit(db, {
    actorUserId: actor.userId,
    action: "vault.view.list",
    targetType: "vault",
    ipPrefix: actor.ipPrefix,
  });
  const rows = await db
    .select({
      id: performers.id,
      stageName: performers.stageName,
      status: performers.status,
      verifiedAt: performers.verifiedAt,
    })
    .from(performers)
    .orderBy(performers.stageName);
  const docCounts = await db
    .select({ performerId: vaultDocuments.performerId, n: count() })
    .from(vaultDocuments)
    .groupBy(vaultDocuments.performerId);
  const linkCounts = await db
    .select({ performerId: mediaPerformers.performerId, n: count() })
    .from(mediaPerformers)
    .groupBy(mediaPerformers.performerId);
  const d = new Map(docCounts.map((r) => [r.performerId, Number(r.n)]));
  const l = new Map(linkCounts.map((r) => [r.performerId, Number(r.n)]));
  return rows.map((r) => ({ ...r, documents: d.get(r.id) ?? 0, links: l.get(r.id) ?? 0 }));
}

/** Decrypts identity data. Audited. */
export async function getPerformer(db: AppDb, kr: VaultKeyring, actor: Actor, id: string) {
  const row = await db.query.performers.findFirst({ where: eq(performers.id, id) });
  if (!row) return null;
  await recordAudit(db, {
    actorUserId: actor.userId,
    action: "vault.view.performer",
    targetType: "performer",
    targetId: id,
    ipPrefix: actor.ipPrefix,
  });
  const docs = await db
    .select({
      id: vaultDocuments.id,
      kind: vaultDocuments.kind,
      contentType: vaultDocuments.contentType,
      sizeBytes: vaultDocuments.sizeBytes,
      sha256: vaultDocuments.sha256,
      createdAt: vaultDocuments.createdAt,
    })
    .from(vaultDocuments)
    .where(eq(vaultDocuments.performerId, id))
    .orderBy(vaultDocuments.createdAt);
  const links = await db
    .select()
    .from(mediaPerformers)
    .where(eq(mediaPerformers.performerId, id))
    .orderBy(mediaPerformers.productionDate);
  return {
    id: row.id,
    stageName: row.stageName,
    status: row.status,
    verifiedAt: row.verifiedAt,
    pii: decryptPii(kr, row),
    documents: docs,
    links,
  };
}

/** Stage names of verified performers, for the media-linking picker. No PII, not a vault read. */
export async function verifiedPerformerOptions(db: AppDb) {
  return db
    .select({ id: performers.id, stageName: performers.stageName })
    .from(performers)
    .where(eq(performers.status, "verified"))
    .orderBy(performers.stageName);
}

export type VerifyResult =
  { ok: true } | { ok: false; error: "not_found" | "needs_id_document" | "underage" };

export async function markVerified(
  db: AppDb,
  kr: VaultKeyring,
  actor: Actor,
  id: string,
  now = new Date(),
): Promise<VerifyResult> {
  const row = await db.query.performers.findFirst({ where: eq(performers.id, id) });
  if (!row) return { ok: false, error: "not_found" };
  const idDocs = await db
    .select({ n: count() })
    .from(vaultDocuments)
    .where(and(eq(vaultDocuments.performerId, id), eq(vaultDocuments.kind, "id_front")));
  if (Number(idDocs[0]?.n ?? 0) === 0) return { ok: false, error: "needs_id_document" };
  if (ageOn(decryptPii(kr, row).dateOfBirth, todayIso(now)) < 18)
    return { ok: false, error: "underage" };
  await db
    .update(performers)
    .set({ status: "verified", verifiedAt: now, verifiedByUserId: actor.userId, updatedAt: now })
    .where(eq(performers.id, id));
  await recordAudit(db, {
    actorUserId: actor.userId,
    action: "vault.performer.verify",
    targetType: "performer",
    targetId: id,
    ipPrefix: actor.ipPrefix,
  });
  return { ok: true };
}

// ---------- documents ----------
export const MAX_VAULT_DOCUMENT_BYTES = 4 * 1024 * 1024;

/** Content type from magic bytes; the browser-supplied type is not trusted. */
export function sniffDocumentType(
  data: Buffer,
): "image/jpeg" | "image/png" | "application/pdf" | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff)
    return "image/jpeg";
  if (
    data.length >= 8 &&
    data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return "image/png";
  if (data.length >= 5 && data.subarray(0, 5).toString("latin1") === "%PDF-")
    return "application/pdf";
  return null;
}

export type AddDocumentResult =
  { ok: true; id: string } | { ok: false; error: "not_found" | "bad_type" | "too_large" | "empty" };

export async function addDocument(
  db: AppDb,
  kr: VaultKeyring,
  actor: Actor,
  input: { performerId: string; kind: (typeof vaultDocuments.$inferInsert)["kind"]; data: Buffer },
): Promise<AddDocumentResult> {
  if (input.data.length === 0) return { ok: false, error: "empty" };
  if (input.data.length > MAX_VAULT_DOCUMENT_BYTES) return { ok: false, error: "too_large" };
  const contentType = sniffDocumentType(input.data);
  if (!contentType) return { ok: false, error: "bad_type" };
  const performer = await db.query.performers.findFirst({
    where: eq(performers.id, input.performerId),
    columns: { id: true },
  });
  if (!performer) return { ok: false, error: "not_found" };
  const id = randomUUID();
  const { blob, keyVersion } = encryptBlob(kr, input.data, ctxDocument(id, input.performerId));
  await db.insert(vaultDocuments).values({
    id,
    performerId: input.performerId,
    kind: input.kind,
    contentType,
    sizeBytes: input.data.length,
    sha256: sha256Hex(input.data),
    ciphertext: blob,
    keyVersion,
    uploadedByUserId: actor.userId,
  });
  await recordAudit(db, {
    actorUserId: actor.userId,
    action: "vault.document.upload",
    targetType: "vault_document",
    targetId: id,
    metadata: { performerId: input.performerId, kind: input.kind },
    ipPrefix: actor.ipPrefix,
  });
  return { ok: true, id };
}

/** Decrypts a document. Audited. Verifies the stored hash so tampering is detected. */
export async function readDocument(db: AppDb, kr: VaultKeyring, actor: Actor, id: string) {
  const row = await db.query.vaultDocuments.findFirst({ where: eq(vaultDocuments.id, id) });
  if (!row) return null;
  await recordAudit(db, {
    actorUserId: actor.userId,
    action: "vault.document.download",
    targetType: "vault_document",
    targetId: id,
    metadata: { performerId: row.performerId, kind: row.kind },
    ipPrefix: actor.ipPrefix,
  });
  const data = decryptBlob(
    kr,
    row.ciphertext,
    row.keyVersion,
    ctxDocument(row.id, row.performerId),
  );
  if (sha256Hex(data) !== row.sha256) throw new Error("vault document integrity check failed");
  return { data, contentType: row.contentType, kind: row.kind, performerId: row.performerId };
}

// ---------- media links (the 2257 index) ----------
export type LinkResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "media_not_found"
        | "performer_not_verified"
        | "underage_at_production"
        | "future_date"
        | "bad_date"
        | "duplicate";
    };

export async function linkMedia(
  db: AppDb,
  kr: VaultKeyring,
  actor: Actor,
  input: { mediaId: string; performerId: string; productionDate: string },
  now = new Date(),
): Promise<LinkResult> {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.productionDate) ||
    Number.isNaN(Date.parse(input.productionDate))
  )
    return { ok: false, error: "bad_date" };
  if (input.productionDate > todayIso(now)) return { ok: false, error: "future_date" };
  const m = await db
    .select({ id: media.id, title: posts.title })
    .from(media)
    .innerJoin(posts, eq(posts.id, media.postId))
    .where(eq(media.id, input.mediaId))
    .limit(1);
  if (!m[0]) return { ok: false, error: "media_not_found" };
  const p = await db.query.performers.findFirst({ where: eq(performers.id, input.performerId) });
  if (!p || p.status !== "verified") return { ok: false, error: "performer_not_verified" };
  if (ageOn(decryptPii(kr, p).dateOfBirth, input.productionDate) < 18)
    return { ok: false, error: "underage_at_production" };
  const inserted = await db
    .insert(mediaPerformers)
    .values({
      mediaId: input.mediaId,
      mediaRef: input.mediaId,
      postTitleSnapshot: m[0].title,
      performerId: p.id,
      productionDate: input.productionDate,
      createdByUserId: actor.userId,
    })
    .onConflictDoNothing()
    .returning({ id: mediaPerformers.id });
  if (!inserted.length) return { ok: false, error: "duplicate" };
  await recordAudit(db, {
    actorUserId: actor.userId,
    action: "vault.link.create",
    targetType: "media",
    targetId: input.mediaId,
    metadata: { performerId: p.id, productionDate: input.productionDate },
    ipPrefix: actor.ipPrefix,
  });
  return { ok: true };
}

/** Links every not-yet-compliant media item on a post to one performer. For back-catalogue imports. */
export async function linkAllMediaOnPost(
  db: AppDb,
  kr: VaultKeyring,
  actor: Actor,
  input: { postId: string; performerId: string; productionDate: string },
  now = new Date(),
): Promise<{ linked: number; errors: string[] }> {
  const items = await db.select({ id: media.id }).from(media).where(eq(media.postId, input.postId));
  const done = await compliantMediaIds(
    db,
    items.map((i) => i.id),
  );
  let linked = 0;
  const errors: string[] = [];
  for (const m of items) {
    if (done.has(m.id)) continue;
    const r = await linkMedia(
      db,
      kr,
      actor,
      { mediaId: m.id, performerId: input.performerId, productionDate: input.productionDate },
      now,
    );
    if (r.ok) linked++;
    else if (!errors.includes(r.error)) errors.push(r.error);
  }
  return { linked, errors };
}

export async function unlinkMedia(db: AppDb, actor: Actor, linkId: string) {
  const rows = await db.delete(mediaPerformers).where(eq(mediaPerformers.id, linkId)).returning();
  if (rows[0]) {
    await recordAudit(db, {
      actorUserId: actor.userId,
      action: "vault.link.delete",
      targetType: "media",
      targetId: rows[0].mediaRef,
      metadata: { performerId: rows[0].performerId },
      ipPrefix: actor.ipPrefix,
    });
  }
  return rows.length > 0;
}

/** For the post editor: links per media with stage names (no PII). */
export async function linksForMedia(db: AppDb, mediaIds: string[]) {
  if (!mediaIds.length) return [];
  return db
    .select({
      id: mediaPerformers.id,
      mediaId: mediaPerformers.mediaId,
      stageName: performers.stageName,
      status: performers.status,
      productionDate: mediaPerformers.productionDate,
    })
    .from(mediaPerformers)
    .innerJoin(performers, eq(performers.id, mediaPerformers.performerId))
    .where(inArray(mediaPerformers.mediaId, mediaIds));
}

/**
 * Media ids that have at least one link to a VERIFIED performer. This is the compliance gate:
 * publishing requires it for every item, and fan-facing views drop any item that lacks it.
 */
export async function compliantMediaIds(db: AppDb, mediaIds: string[]): Promise<Set<string>> {
  if (!mediaIds.length) return new Set();
  const rows = await db
    .selectDistinct({ mediaId: mediaPerformers.mediaId })
    .from(mediaPerformers)
    .innerJoin(performers, eq(performers.id, mediaPerformers.performerId))
    .where(and(inArray(mediaPerformers.mediaId, mediaIds), eq(performers.status, "verified")));
  return new Set(rows.map((r) => r.mediaId!).filter(Boolean));
}

// ---------- export ----------
function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  // Neutralize spreadsheet formula injection as well as quoting.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Full index with decrypted identity fields, for the custodian or an inspector. Audited. */
export async function exportIndexCsv(db: AppDb, kr: VaultKeyring, actor: Actor): Promise<string> {
  await recordAudit(db, {
    actorUserId: actor.userId,
    action: "vault.export",
    targetType: "vault",
    ipPrefix: actor.ipPrefix,
  });
  const all = await db.select().from(performers);
  const byId = new Map(all.map((p) => [p.id, { row: p, pii: decryptPii(kr, p) }]));
  const links = await db.select().from(mediaPerformers).orderBy(mediaPerformers.productionDate);
  const docs = await db
    .select({
      performerId: vaultDocuments.performerId,
      kind: vaultDocuments.kind,
      sha256: vaultDocuments.sha256,
      id: vaultDocuments.id,
    })
    .from(vaultDocuments);
  const header = [
    "media_ref",
    "media_still_on_site",
    "post_title",
    "production_date",
    "performer_id",
    "stage_name",
    "legal_name",
    "aliases",
    "date_of_birth",
    "age_at_production",
    "id_type",
    "id_number",
    "id_issuer",
    "id_expiration",
    "verified_at",
    "document_ids_and_sha256",
  ];
  const lines = [header.join(",")];
  for (const l of links) {
    const p = byId.get(l.performerId);
    if (!p) continue;
    const d = docs
      .filter((x) => x.performerId === l.performerId)
      .map((x) => `${x.kind}:${x.id}:${x.sha256}`)
      .join(" ");
    lines.push(
      [
        l.mediaRef,
        l.mediaId ? "yes" : "no",
        l.postTitleSnapshot,
        l.productionDate,
        l.performerId,
        p.row.stageName,
        p.pii.legalName,
        p.pii.aliases.join("; "),
        p.pii.dateOfBirth,
        ageOn(p.pii.dateOfBirth, l.productionDate),
        p.pii.idType,
        p.pii.idNumber,
        p.pii.idIssuer,
        p.pii.idExpiration ?? "",
        p.row.verifiedAt?.toISOString() ?? "",
        d,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\n") + "\n";
}

export { sql };
