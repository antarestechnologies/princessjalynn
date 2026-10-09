import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signUp } from "@/auth/service";
import {
  auditLog,
  media,
  mediaPerformers,
  performers,
  posts,
  users,
  vaultDocuments,
} from "@/db/schema";
import { createTestDb } from "@/db/test-db";
import { fakeIdImage, makeVerifiedPerformer, testKeyring } from "./testing";
import {
  addDocument,
  ageOn,
  compliantMediaIds,
  createPerformer,
  exportIndexCsv,
  getPerformer,
  linkMedia,
  listPerformers,
  markVerified,
  readDocument,
  sniffDocumentType,
  unlinkMedia,
} from "./vault";

let t: Awaited<ReturnType<typeof createTestDb>>;
let adminId: string;
let mediaId: string;
const kr = testKeyring();
const actor = () => ({ userId: adminId, ipPrefix: "203.0.113.0/24" });
const PII = {
  legalName: "Unique Legal Name Zq",
  aliases: ["Alias One"],
  dateOfBirth: "1990-06-15",
  idType: "passport" as const,
  idNumber: "P99887766",
  idIssuer: "United States",
};

async function auditActions() {
  return (await t.db.select({ a: auditLog.action }).from(auditLog)).map((r) => r.a);
}

beforeAll(async () => {
  t = await createTestDb();
  const r = await signUp(t.db, {
    email: "adm@example.com",
    password: "a-long-enough-password",
    handle: "adm",
  });
  if (!r.ok || r.existing) throw new Error("setup");
  adminId = r.userId;
  await t.db.update(users).set({ role: "admin" }).where(eq(users.id, adminId));
  const [p] = await t.db
    .insert(posts)
    .values({ title: "Shoot one", tier: "subscriber" })
    .returning();
  const [m] = await t.db
    .insert(media)
    .values({
      postId: p.id,
      kind: "image",
      provider: "fake",
      providerAssetId: "x",
      status: "ready",
    })
    .returning();
  mediaId = m.id;
});
afterAll(async () => {
  await t.close();
});

describe("performer records", () => {
  it("store identity data only as ciphertext", async () => {
    const id = await createPerformer(t.db, kr, actor(), { stageName: "Stage A", pii: PII });
    const raw = await t.db.execute(sql`select * from performers where id = ${id}`);
    const dump =
      JSON.stringify(raw) +
      (await t.db.select().from(performers))
        .map((r) => r.piiCiphertext.toString("latin1"))
        .join("");
    for (const secret of [PII.legalName, PII.idNumber, PII.dateOfBirth, "Alias One"])
      expect(dump).not.toContain(secret);
    expect(dump).toContain("Stage A");
  });

  it("decrypt on view, and the view is audited", async () => {
    const id = await createPerformer(t.db, kr, actor(), { stageName: "Stage B", pii: PII });
    const before = (await auditActions()).filter((a) => a === "vault.view.performer").length;
    const p = await getPerformer(t.db, kr, actor(), id);
    expect(p?.pii.legalName).toBe(PII.legalName);
    expect(p?.pii.idNumber).toBe(PII.idNumber);
    expect((await auditActions()).filter((a) => a === "vault.view.performer").length).toBe(
      before + 1,
    );
    await listPerformers(t.db, actor());
    expect(await auditActions()).toContain("vault.view.list");
  });

  it("cannot be read with another key", async () => {
    const id = await createPerformer(t.db, kr, actor(), { stageName: "Stage C", pii: PII });
    await expect(getPerformer(t.db, testKeyring(), actor(), id)).rejects.toThrow();
  });

  it("verification requires an ID document and an adult date of birth", async () => {
    const id = await createPerformer(t.db, kr, actor(), { stageName: "Stage D", pii: PII });
    expect(await markVerified(t.db, kr, actor(), id)).toEqual({
      ok: false,
      error: "needs_id_document",
    });
    await addDocument(t.db, kr, actor(), {
      performerId: id,
      kind: "model_release",
      data: await fakeIdImage(),
    });
    expect(await markVerified(t.db, kr, actor(), id)).toEqual({
      ok: false,
      error: "needs_id_document",
    });
    await addDocument(t.db, kr, actor(), {
      performerId: id,
      kind: "id_front",
      data: await fakeIdImage(),
    });
    expect(await markVerified(t.db, kr, actor(), id)).toEqual({ ok: true });

    const minor = await createPerformer(t.db, kr, actor(), {
      stageName: "Too young",
      pii: { ...PII, dateOfBirth: "2012-01-01" },
    });
    await addDocument(t.db, kr, actor(), {
      performerId: minor,
      kind: "id_front",
      data: await fakeIdImage(),
    });
    expect(await markVerified(t.db, kr, actor(), minor, new Date("2026-10-09T00:00:00Z"))).toEqual({
      ok: false,
      error: "underage",
    });
  });
});

describe("vault documents", () => {
  it("are encrypted at rest, decrypt to the original bytes, and every download is audited", async () => {
    const id = await createPerformer(t.db, kr, actor(), { stageName: "Docs", pii: PII });
    const img = await fakeIdImage();
    const up = await addDocument(t.db, kr, actor(), {
      performerId: id,
      kind: "id_front",
      data: img,
    });
    if (!up.ok) throw new Error(up.error);
    const row = (await t.db.query.vaultDocuments.findFirst({
      where: eq(vaultDocuments.id, up.id),
    }))!;
    expect(row.ciphertext.includes(img.subarray(0, 64))).toBe(false);
    expect(row.contentType).toBe("image/jpeg");
    const before = (await auditActions()).filter((a) => a === "vault.document.download").length;
    const doc = await readDocument(t.db, kr, actor(), up.id);
    expect(doc?.data.equals(img)).toBe(true);
    expect((await auditActions()).filter((a) => a === "vault.document.download").length).toBe(
      before + 1,
    );
  });

  it("detects a ciphertext moved to another document row", async () => {
    const id = await createPerformer(t.db, kr, actor(), { stageName: "Swap", pii: PII });
    const a = await addDocument(t.db, kr, actor(), {
      performerId: id,
      kind: "id_front",
      data: await fakeIdImage(),
    });
    const b = await addDocument(t.db, kr, actor(), {
      performerId: id,
      kind: "id_back",
      data: Buffer.from("%PDF-1.4 other"),
    });
    if (!a.ok || !b.ok) throw new Error("setup");
    const rowA = (await t.db.query.vaultDocuments.findFirst({
      where: eq(vaultDocuments.id, a.id),
    }))!;
    await t.db
      .update(vaultDocuments)
      .set({ ciphertext: rowA.ciphertext })
      .where(eq(vaultDocuments.id, b.id));
    await expect(readDocument(t.db, kr, actor(), b.id)).rejects.toThrow();
  });

  it("accepts only JPEG, PNG and PDF by content, and caps size", async () => {
    const id = await createPerformer(t.db, kr, actor(), { stageName: "Types", pii: PII });
    expect(sniffDocumentType(Buffer.from("%PDF-1.7"))).toBe("application/pdf");
    expect(sniffDocumentType(Buffer.from("<html>"))).toBeNull();
    expect(
      await addDocument(t.db, kr, actor(), {
        performerId: id,
        kind: "other",
        data: Buffer.from("MZ\x90\x00exe"),
      }),
    ).toEqual({ ok: false, error: "bad_type" });
    expect(
      await addDocument(t.db, kr, actor(), {
        performerId: id,
        kind: "other",
        data: Buffer.alloc(0),
      }),
    ).toEqual({ ok: false, error: "empty" });
    expect(
      await addDocument(t.db, kr, actor(), {
        performerId: id,
        kind: "other",
        data: Buffer.alloc(5 * 1024 * 1024, 0xff),
      }),
    ).toEqual({ ok: false, error: "too_large" });
  });
});

describe("media links (2257 index)", () => {
  it("only verified, adult-at-production performers can be linked, and links are audited", async () => {
    const draft = await createPerformer(t.db, kr, actor(), { stageName: "Draft", pii: PII });
    expect(
      await linkMedia(t.db, kr, actor(), {
        mediaId,
        performerId: draft,
        productionDate: "2026-01-01",
      }),
    ).toEqual({ ok: false, error: "performer_not_verified" });

    const young = await makeVerifiedPerformer(t.db, kr, adminId, {
      dateOfBirth: "2007-03-01",
      stageName: "Just18",
    });
    expect(
      await linkMedia(t.db, kr, actor(), {
        mediaId,
        performerId: young,
        productionDate: "2025-02-28",
      }),
    ).toEqual({ ok: false, error: "underage_at_production" });
    expect(
      await linkMedia(
        t.db,
        kr,
        actor(),
        { mediaId, performerId: young, productionDate: "2099-01-01" },
        new Date("2026-10-09T00:00:00Z"),
      ),
    ).toEqual({ ok: false, error: "future_date" });
    expect(
      await linkMedia(t.db, kr, actor(), { mediaId, performerId: young, productionDate: "nope" }),
    ).toEqual({ ok: false, error: "bad_date" });

    expect(await compliantMediaIds(t.db, [mediaId])).toEqual(new Set());
    expect(
      await linkMedia(t.db, kr, actor(), {
        mediaId,
        performerId: young,
        productionDate: "2025-03-01",
      }),
    ).toEqual({ ok: true });
    expect(await compliantMediaIds(t.db, [mediaId])).toEqual(new Set([mediaId]));
    expect(
      await linkMedia(t.db, kr, actor(), {
        mediaId,
        performerId: young,
        productionDate: "2025-03-01",
      }),
    ).toEqual({ ok: false, error: "duplicate" });
    expect(await auditActions()).toContain("vault.link.create");
  });

  it("ageOn handles birthdays exactly", () => {
    expect(ageOn("2007-03-01", "2025-02-28")).toBe(17);
    expect(ageOn("2007-03-01", "2025-03-01")).toBe(18);
    expect(ageOn("2008-02-29", "2026-02-28")).toBe(17);
    expect(ageOn("2008-02-29", "2026-03-01")).toBe(18);
  });

  it("survive media deletion so the records outlive the content", async () => {
    const [p] = await t.db
      .insert(posts)
      .values({ title: "Removed later", tier: "free" })
      .returning();
    const [m] = await t.db
      .insert(media)
      .values({
        postId: p.id,
        kind: "image",
        provider: "fake",
        providerAssetId: "y",
        status: "ready",
      })
      .returning();
    const perf = await makeVerifiedPerformer(t.db, kr, adminId, { stageName: "Keeper" });
    await linkMedia(t.db, kr, actor(), {
      mediaId: m.id,
      performerId: perf,
      productionDate: "2026-02-02",
    });
    await t.db.delete(media).where(eq(media.id, m.id));
    const row = (await t.db.query.mediaPerformers.findFirst({
      where: eq(mediaPerformers.mediaRef, m.id),
    }))!;
    expect(row.mediaId).toBeNull();
    expect(row.postTitleSnapshot).toBe("Removed later");
  });

  it("unlinking removes compliance and is audited", async () => {
    const row = (await t.db.query.mediaPerformers.findFirst({
      where: eq(mediaPerformers.mediaId, mediaId),
    }))!;
    expect(await unlinkMedia(t.db, actor(), row.id)).toBe(true);
    expect(await compliantMediaIds(t.db, [mediaId])).toEqual(new Set());
    expect(await auditActions()).toContain("vault.link.delete");
  });
});

describe("export", () => {
  it("produces the decrypted index, neutralizes formula injection, and is audited", async () => {
    const perf = await makeVerifiedPerformer(t.db, kr, adminId, { stageName: "=HYPERLINK(evil)" });
    await linkMedia(t.db, kr, actor(), {
      mediaId,
      performerId: perf,
      productionDate: "2026-01-20",
    });
    const csv = await exportIndexCsv(t.db, kr, actor());
    const lines = csv.trim().split("\n");
    expect(lines[0]).toContain("legal_name");
    const row = lines.find((l) => l.includes("2026-01-20"))!;
    expect(row).toContain("Test Performer Legal Name");
    expect(row).toContain("'=HYPERLINK(evil)");
    expect(row).toContain("Shoot one");
    expect(await auditActions()).toContain("vault.export");
  });

  it("audit metadata never contains identity data", async () => {
    const dump = JSON.stringify(await t.db.select().from(auditLog));
    for (const secret of [
      PII.legalName,
      PII.idNumber,
      "Test Performer Legal Name",
      "D1234567",
      "P99887766",
    ])
      expect(dump).not.toContain(secret);
  });
});
