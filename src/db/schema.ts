import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Phase 1 schema. Column names are snake_case via drizzle.config `casing`.
 *
 * Money is always integer minor units (cents) + ISO currency. Timestamps are timestamptz.
 * Nothing here stores card data (non-negotiable #1) or ID documents (non-negotiable #5):
 * the 2257 vault is a separate, admin-only table set added in Phase 5.
 */

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
};

// ---------- enums ----------
export const userRole = pgEnum("user_role", ["fan", "admin"]);
export const userStatus = pgEnum("user_status", ["active", "suspended", "deleted"]);
export const subscriptionStatus = pgEnum("subscription_status", [
  "active", // paid through currentPeriodEnd
  "past_due", // renewal failed, inside grace period
  "canceled", // fan canceled; access until currentPeriodEnd
  "expired", // period ended without renewal
  "chargeback", // disputed; access revoked, account flagged
]);
export const paymentStatus = pgEnum("payment_status", ["paid", "refunded", "chargeback"]);
export const postTier = pgEnum("post_tier", ["free", "subscriber", "ppv"]);
export const postStatus = pgEnum("post_status", ["draft", "scheduled", "published", "archived"]);
export const mediaKind = pgEnum("media_kind", ["image", "video"]);
export const mediaStatus = pgEnum("media_status", ["uploading", "processing", "ready", "failed"]);
export const entitlementKind = pgEnum("entitlement_kind", ["subscription", "post"]);
export const entitlementSource = pgEnum("entitlement_source", [
  "subscription",
  "purchase",
  "grant",
]);
export const takedownStatus = pgEnum("takedown_status", [
  "new",
  "reviewing",
  "actioned",
  "rejected",
]);

// ---------- users ----------
export const users = pgTable(
  "users",
  {
    id: uuid().primaryKey().defaultRandom(),
    email: text().notNull(),
    emailVerifiedAt: timestamp({ withTimezone: true }),
    passwordHash: text().notNull(),
    /** Public handle shown in the per-viewer watermark. Short, unique, never the email. */
    handle: text().notNull(),
    role: userRole().notNull().default("fan"),
    status: userStatus().notNull().default("active"),
    /** 18+ self-attestation at the age gate (Phase 2). */
    ageAttestedAt: timestamp({ withTimezone: true }),
    /** Third-party age/ID verification result. We store the vendor's reference, never the document. */
    ageVerifiedAt: timestamp({ withTimezone: true }),
    ageVerificationProvider: text(),
    ageVerificationRef: text(),
    /** Set when a chargeback or abuse report flags the account for admin review. */
    flagged: boolean().notNull().default(false),
    deletedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("users_email_lower_idx").on(sql`lower(${t.email})`),
    uniqueIndex("users_handle_lower_idx").on(sql`lower(${t.handle})`),
  ],
);

// ---------- posts & media ----------
export const posts = pgTable(
  "posts",
  {
    id: uuid().primaryKey().defaultRandom(),
    title: text().notNull(),
    caption: text(),
    tier: postTier().notNull().default("subscriber"),
    /** Required when tier = 'ppv'. Minor units. */
    priceCents: integer(),
    currency: text().notNull().default("USD"),
    status: postStatus().notNull().default("draft"),
    /** When status = 'scheduled', the time at which it becomes published. */
    publishAt: timestamp({ withTimezone: true }),
    publishedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("posts_status_publish_at_idx").on(t.status, t.publishAt),
    check(
      "posts_ppv_price_check",
      sql`${t.tier} <> 'ppv' or (${t.priceCents} is not null and ${t.priceCents} > 0)`,
    ),
  ],
);

export const media = pgTable(
  "media",
  {
    id: uuid().primaryKey().defaultRandom(),
    postId: uuid()
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    kind: mediaKind().notNull(),
    /** VideoProvider implementation name, e.g. 'bunny'. */
    provider: text().notNull(),
    /** Opaque id at the provider. Never a public URL (non-negotiable #2). */
    providerAssetId: text().notNull(),
    status: mediaStatus().notNull().default("uploading"),
    durationSeconds: integer(),
    width: integer(),
    height: integer(),
    /** Storage keys (not URLs) for the poster and the blurred locked-state preview. */
    thumbnailKey: text(),
    blurredPreviewKey: text(),
    sortOrder: integer().notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("media_post_id_idx").on(t.postId),
    uniqueIndex("media_provider_asset_idx").on(t.provider, t.providerAssetId),
  ],
);

// ---------- money ----------
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    /** PaymentProcessor implementation name, e.g. 'fake', 'ccbill'. */
    processor: text().notNull(),
    processorSubscriptionId: text().notNull(),
    processorCustomerId: text(),
    status: subscriptionStatus().notNull(),
    priceCents: integer().notNull(),
    currency: text().notNull().default("USD"),
    currentPeriodStart: timestamp({ withTimezone: true }).notNull(),
    currentPeriodEnd: timestamp({ withTimezone: true }).notNull(),
    /** For past_due: access continues until this instant, then expires. */
    graceUntil: timestamp({ withTimezone: true }),
    canceledAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("subscriptions_processor_sub_idx").on(t.processor, t.processorSubscriptionId),
    index("subscriptions_user_id_idx").on(t.userId),
  ],
);

export const purchases = pgTable(
  "purchases",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    postId: uuid()
      .notNull()
      .references(() => posts.id, { onDelete: "restrict" }),
    processor: text().notNull(),
    processorTransactionId: text().notNull(),
    amountCents: integer().notNull(),
    currency: text().notNull().default("USD"),
    status: paymentStatus().notNull().default("paid"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("purchases_processor_txn_idx").on(t.processor, t.processorTransactionId),
    index("purchases_user_post_idx").on(t.userId, t.postId),
  ],
);

export const tips = pgTable(
  "tips",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    /** Optional: the post the tip was left on. */
    postId: uuid().references(() => posts.id, { onDelete: "set null" }),
    processor: text().notNull(),
    processorTransactionId: text().notNull(),
    amountCents: integer().notNull(),
    currency: text().notNull().default("USD"),
    status: paymentStatus().notNull().default("paid"),
    message: text(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("tips_processor_txn_idx").on(t.processor, t.processorTransactionId),
    index("tips_user_id_idx").on(t.userId),
  ],
);

// ---------- access ----------
/**
 * The single source of truth for "can this user see this". Every playback-token request
 * checks here, never against subscriptions/purchases directly. Rows are granted by payment
 * webhooks (Phase 4) or by an admin ('grant') and revoked by cancellation, expiry, refund
 * or chargeback. A row is live when revokedAt is null and now() is within [startsAt, endsAt).
 */
export const entitlements = pgTable(
  "entitlements",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: entitlementKind().notNull(),
    /** Null for kind = 'subscription' (all subscriber-tier posts); the post for kind = 'post'. */
    postId: uuid().references(() => posts.id, { onDelete: "cascade" }),
    source: entitlementSource().notNull(),
    /** subscriptions.id, purchases.id, or the granting admin's users.id. */
    sourceId: uuid().notNull(),
    startsAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** Null = open-ended (PPV purchases). Subscriptions set this to the period end. */
    endsAt: timestamp({ withTimezone: true }),
    revokedAt: timestamp({ withTimezone: true }),
    revokeReason: text(),
    ...timestamps,
  },
  (t) => [
    index("entitlements_user_kind_post_idx").on(t.userId, t.kind, t.postId),
    index("entitlements_source_idx").on(t.source, t.sourceId),
  ],
);

// ---------- compliance ----------
/**
 * Append-only. A trigger (see drizzle/*_audit_log_immutable.sql) rejects UPDATE and DELETE.
 * Records admin actions and, from Phase 5, every access to the 2257 vault.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    /** Null for system actions (webhooks, cron). */
    actorUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    action: text().notNull(),
    targetType: text().notNull(),
    targetId: text(),
    /** Must already be scrubbed of PII by the caller; the logger's scrub() is reused for this. */
    metadata: jsonb().$type<Record<string, unknown>>(),
    /** Truncated (/24 or /48) by the caller; never a full IP. */
    ipPrefix: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_actor_idx").on(t.actorUserId, t.createdAt),
    index("audit_log_target_idx").on(t.targetType, t.targetId),
  ],
);

export const takedownRequests = pgTable(
  "takedown_requests",
  {
    id: uuid().primaryKey().defaultRandom(),
    reporterName: text().notNull(),
    reporterEmail: text().notNull(),
    /** e.g. 'copyright_owner', 'depicted_person', 'agent', 'other'. Free text until legal defines it. */
    reporterRelationship: text(),
    /** URLs on our site that the request concerns. */
    contentUrls: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    description: text().notNull(),
    /** Sworn-statement checkbox for DMCA-style notices. */
    goodFaithAttested: boolean().notNull().default(false),
    status: takedownStatus().notNull().default("new"),
    assignedToUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    resolutionNotes: text(),
    resolvedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("takedown_requests_status_idx").on(t.status, t.createdAt)],
);
