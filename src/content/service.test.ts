import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signUp } from "@/auth/service";
import { auditLog, playbackGrants, users } from "@/db/schema";
import { createTestDb } from "@/db/test-db";
import { FakeImageStorage, FakeVideoProvider } from "@/media/fake";
import { link, makeVerifiedPerformer, testKeyring } from "@/compliance/testing";
import { issueViewGrants, PLAYBACK_TTL_SECONDS } from "./playback";
import {
  createImageMedia,
  createPost,
  createVideoMedia,
  getPost,
  listPublishedPosts,
  publishPost,
  syncVideoStatus,
} from "./service";

let t: Awaited<ReturnType<typeof createTestDb>>;
let storage: FakeImageStorage;
let video: FakeVideoProvider;
let admin: typeof users.$inferSelect;
let performerId: string;
const kr = testKeyring();
const S = "test-secret-that-is-at-least-32-characters-long";

beforeAll(async () => {
  t = await createTestDb();
  storage = new FakeImageStorage(
    await mkdtemp(path.join(os.tmpdir(), "content-test-")),
    "https://members.example",
    S,
  );
  video = new FakeVideoProvider(storage, "https://members.example");
  const r = await signUp(t.db, {
    email: "adm@example.com",
    password: "a-long-enough-password",
    handle: "adm",
  });
  if (!r.ok || r.existing) throw new Error("setup");
  await t.db
    .update(users)
    .set({ role: "admin", emailVerifiedAt: new Date(), ageVerifiedAt: new Date() })
    .where(eq(users.id, r.userId));
  admin = (await t.db.query.users.findFirst({ where: eq(users.id, r.userId) }))!;
  performerId = await makeVerifiedPerformer(t.db, kr, admin.id);
});
afterAll(async () => {
  await t.close();
});

describe("posts and media", () => {
  it("refuses to publish a post with no ready media, then publishes once an image is attached", async () => {
    const post = await createPost(t.db, admin.id, {
      title: "First",
      caption: null,
      tier: "subscriber",
      priceCents: null,
    });
    expect(await publishPost(t.db, admin.id, post.id, null)).toEqual({
      ok: false,
      error: "no_ready_media",
    });

    const jpeg = await sharp({
      create: { width: 800, height: 600, channels: 3, background: "#333" },
    })
      .jpeg()
      .toBuffer();
    const m = await createImageMedia(t.db, storage, admin.id, post.id, jpeg);
    expect(m.status).toBe("ready");
    expect(m.storageKey).toMatch(/^images\/.+\/original\.jpg$/);
    expect(await storage.exists(m.blurredPreviewKey!)).toBe(true);

    // 2257 gate: an unlinked media item blocks publishing.
    expect(await publishPost(t.db, admin.id, post.id, null)).toEqual({
      ok: false,
      error: "missing_2257",
      mediaIds: [m.id],
    });
    await link(t.db, kr, admin.id, m.id, performerId);

    const pub = await publishPost(t.db, admin.id, post.id, null);
    expect(pub.ok && pub.post.status).toBe("published");
    expect((await listPublishedPosts(t.db)).map((p) => p.id)).toContain(post.id);
  });

  it("schedules when publishAt is in the future and lists it only after that time", async () => {
    const post = await createPost(t.db, admin.id, {
      title: "Later",
      caption: null,
      tier: "free",
      priceCents: null,
    });
    const jpeg = await sharp({
      create: { width: 100, height: 100, channels: 3, background: "#999" },
    })
      .jpeg()
      .toBuffer();
    const m = await createImageMedia(t.db, storage, admin.id, post.id, jpeg);
    await link(t.db, kr, admin.id, m.id, performerId);
    const when = new Date(Date.now() + 60 * 60 * 1000);
    const r = await publishPost(t.db, admin.id, post.id, when);
    expect(r.ok && r.post.status).toBe("scheduled");
    expect((await listPublishedPosts(t.db)).map((p) => p.id)).not.toContain(post.id);
    expect(
      (await listPublishedPosts(t.db, new Date(when.getTime() + 1000))).map((p) => p.id),
    ).toContain(post.id);
  });

  it("tracks a video from upload to ready through the provider", async () => {
    const post = await createPost(t.db, admin.id, {
      title: "Clip",
      caption: null,
      tier: "ppv",
      priceCents: 500,
    });
    const { media: m, upload } = await createVideoMedia(t.db, video, admin.id, post.id, "Clip");
    expect(m.status).toBe("uploading");
    expect(upload.method).toBe("put");
    expect((await syncVideoStatus(t.db, video, storage, m.id))?.status).toBe("processing");
    await storage.put(FakeVideoProvider.keyFor(m.providerAssetId), Buffer.from("mp4"), "video/mp4");
    expect((await syncVideoStatus(t.db, video, storage, m.id))?.status).toBe("ready");
  });

  it("issues expiring grants with a watermark and records them for leak tracing", async () => {
    const post = (await getPost(t.db, (await listPublishedPosts(t.db))[0].id))!;
    const now = new Date();
    const grants = await issueViewGrants(
      t.db,
      { video, storage },
      { user: admin, items: post.media, ipPrefix: "203.0.113.0/24" },
      now,
    );
    expect(grants.items).toHaveLength(1);
    expect(grants.watermark.handle).toBe("adm");
    expect(grants.items[0].nonce).toBe(grants.watermark.nonce);
    expect(new Date(grants.items[0].expiresAt).getTime()).toBe(
      now.getTime() + PLAYBACK_TTL_SECONDS * 1000,
    );
    expect(grants.items[0].source?.url).toMatch(/token=/);
    const rows = await t.db.query.playbackGrants.findMany({
      where: eq(playbackGrants.userId, admin.id),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].watermarkNonce).toBe(grants.watermark.nonce);
    expect(rows[0].ipPrefix).toBe("203.0.113.0/24");
  });

  it("writes admin audit rows", async () => {
    const actions = new Set(
      (await t.db.select({ a: auditLog.action }).from(auditLog)).map((r) => r.a),
    );
    for (const a of [
      "post.create",
      "post.publish",
      "post.schedule",
      "media.image.upload",
      "media.video.create",
    ])
      expect(actions, a).toContain(a);
  });
});
