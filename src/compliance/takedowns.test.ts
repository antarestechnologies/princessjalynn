import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signUp } from "@/auth/service";
import { auditLog } from "@/db/schema";
import { createTestDb } from "@/db/test-db";
import {
  getTakedown,
  listTakedowns,
  submitTakedown,
  takedownInputSchema,
  updateTakedown,
} from "./takedowns";

let t: Awaited<ReturnType<typeof createTestDb>>;
let adminId: string;

beforeAll(async () => {
  t = await createTestDb();
  const r = await signUp(t.db, {
    email: "adm@example.com",
    password: "a-long-enough-password",
    handle: "adm",
  });
  if (!r.ok || r.existing) throw new Error("setup");
  adminId = r.userId;
});
afterAll(async () => {
  await t.close();
});

const valid = {
  reporterName: "Reporter Person",
  reporterEmail: "reporter@example.org",
  reporterRelationship: "depicted_person",
  contentUrls: "https://members.example/p/1\nhttps://members.example/p/2",
  description: "This shows me without my consent.",
  goodFaithAttested: true,
};

describe("takedown intake", () => {
  it("validates input: URLs, statement, relationship", () => {
    expect(takedownInputSchema.safeParse(valid).success).toBe(true);
    expect(takedownInputSchema.safeParse({ ...valid, contentUrls: "" }).success).toBe(false);
    expect(takedownInputSchema.safeParse({ ...valid, contentUrls: "not a url" }).success).toBe(
      false,
    );
    expect(takedownInputSchema.safeParse({ ...valid, goodFaithAttested: false }).success).toBe(
      false,
    );
    expect(takedownInputSchema.safeParse({ ...valid, reporterRelationship: "boss" }).success).toBe(
      false,
    );
    expect(takedownInputSchema.parse(valid).contentUrls).toHaveLength(2);
  });

  it("stores the report, lists it, and audits without the reporter's PII", async () => {
    const id = await submitTakedown(t.db, takedownInputSchema.parse(valid), {
      ipPrefix: "198.51.100.0/24",
    });
    const row = await getTakedown(t.db, id);
    expect(row?.status).toBe("new");
    expect(row?.contentUrls).toHaveLength(2);
    expect((await listTakedowns(t.db)).map((r) => r.id)).toContain(id);
    const audit = await t.db.select().from(auditLog).where(eq(auditLog.targetId, id));
    expect(audit.map((a) => a.action)).toContain("takedown.submitted");
    expect(JSON.stringify(audit)).not.toContain("reporter@example.org");
    expect(JSON.stringify(audit)).not.toContain("Reporter Person");
  });

  it("admin status changes set resolution time, assignment, and are audited", async () => {
    const id = await submitTakedown(t.db, takedownInputSchema.parse(valid));
    await updateTakedown(t.db, adminId, id, { status: "reviewing", assignToMe: true });
    let row = (await getTakedown(t.db, id))!;
    expect(row.status).toBe("reviewing");
    expect(row.assignedToUserId).toBe(adminId);
    expect(row.resolvedAt).toBeNull();
    await updateTakedown(t.db, adminId, id, {
      status: "actioned",
      resolutionNotes: "Post archived.",
    });
    row = (await getTakedown(t.db, id))!;
    expect(row.resolvedAt).toBeInstanceOf(Date);
    expect(row.resolutionNotes).toBe("Post archived.");
    const actions = (await t.db.select().from(auditLog).where(eq(auditLog.targetId, id))).map(
      (a) => a.action,
    );
    expect(actions).toEqual(expect.arrayContaining(["takedown.reviewing", "takedown.actioned"]));
  });

  it("rejects malformed ids without querying", async () => {
    expect(await getTakedown(t.db, "../etc")).toBeNull();
  });
});
