import "dotenv/config";
import { writeFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { createSession } from "../src/auth/service";
import { hashPassword } from "../src/lib/crypto";
import { createGateCookieValue, getSessionSecret } from "../src/lib/age-gate";
import { keyringFromEnv } from "../src/compliance/vault-crypto";
import { encryptBlob } from "../src/compliance/vault-crypto";

/**
 * Seeds a load-test dataset: N verified fans with live subscriptions and sessions, a
 * verified performer, and published posts whose media are 2257-linked. Writes the cookies
 * load-test.ts needs. Never run against production.
 */
async function main() {
  const n = Number(process.argv[2] ?? 200);
  const out = process.argv[3] ?? "load-sessions.json";
  if (/neon\.tech|prod/i.test(process.env.DATABASE_URL ?? ""))
    throw new Error("refusing to seed what looks like production");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  const db = drizzle({ client: pool, schema, casing: "snake_case" });
  const tag = Date.now().toString(36);
  const now = new Date();
  const hash = await hashPassword("load-test-password");
  const kr = keyringFromEnv(process.env, getSessionSecret());

  const perfId = crypto.randomUUID();
  const pii = {
    legalName: "Load Test",
    aliases: [],
    dateOfBirth: "1990-01-01",
    idType: "passport",
    idNumber: "LT1",
    idIssuer: "Test",
  };
  const { blob, keyVersion } = encryptBlob(
    kr,
    Buffer.from(JSON.stringify(pii)),
    `performer:${perfId}`,
  );
  await db.insert(schema.performers).values({
    id: perfId,
    stageName: `Load ${tag}`,
    status: "verified",
    piiCiphertext: blob,
    keyVersion,
    verifiedAt: now,
  });

  const postIds: string[] = [];
  const mediaIds: string[] = [];
  for (let i = 0; i < Number(process.env.LOAD_POSTS ?? 24); i++) {
    const [p] = await db
      .insert(schema.posts)
      .values({
        title: `Load post ${tag} ${i}`,
        tier: i % 3 === 0 ? "free" : "subscriber",
        status: "published",
        publishedAt: now,
      })
      .returning();
    const [m] = await db
      .insert(schema.media)
      .values({
        postId: p.id,
        kind: "image",
        provider: "bunny",
        providerAssetId: `images/${p.id}/original.jpg`,
        storageKey: `images/${p.id}/original.jpg`,
        thumbnailKey: `images/${p.id}/thumb.jpg`,
        blurredPreviewKey: `images/${p.id}/blur.jpg`,
        status: "ready",
        width: 1280,
        height: 1600,
      })
      .returning();
    await db.insert(schema.mediaPerformers).values({
      mediaId: m.id,
      mediaRef: m.id,
      postTitleSnapshot: p.title,
      performerId: perfId,
      productionDate: "2026-01-01",
    });
    postIds.push(p.id);
    mediaIds.push(m.id);
  }

  const sids: string[] = [];
  for (let i = 0; i < n; i++) {
    const [u] = await db
      .insert(schema.users)
      .values({
        email: `load-${tag}-${i}@example.test`,
        handle: `ld${tag}${i}`.slice(0, 20),
        passwordHash: hash,
        emailVerifiedAt: now,
        ageVerifiedAt: now,
      })
      .returning({ id: schema.users.id });
    const [sub] = await db
      .insert(schema.subscriptions)
      .values({
        userId: u.id,
        processor: "fake",
        processorSubscriptionId: `load_${tag}_${i}`,
        status: "active",
        priceCents: 1500,
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 864e5),
      })
      .returning({ id: schema.subscriptions.id });
    await db.insert(schema.entitlements).values({
      userId: u.id,
      kind: "subscription",
      source: "subscription",
      sourceId: sub.id,
      startsAt: now,
      endsAt: new Date(now.getTime() + 30 * 864e5),
    });
    sids.push((await createSession(db, u.id)).token);
  }
  writeFileSync(
    out,
    JSON.stringify({ gate: createGateCookieValue(getSessionSecret()), sids, postIds, mediaIds }),
  );
  console.log(`seeded ${n} fans, ${postIds.length} posts -> ${out}`);
  void eq;
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
