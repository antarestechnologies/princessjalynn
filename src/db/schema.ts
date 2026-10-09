import { relations, sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
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
export const authTokenKind = pgEnum("auth_token_kind", ["email_verify", "password_reset"]);
export const checkoutKind = pgEnum("checkout_kind", ["subscription", "ppv", "tip"]);
export const checkoutStatus = pgEnum("checkout_status", [
  "pending",
  "completed",
  "failed",
  "abandoned",
]);
export const ageVerificationStatus = pgEnum("age_verification_status", [
  "pending",
  "passed",
  "failed",
  "expired",
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
    /** For images: the storage key of the full-size file. Null for provider-hosted video. */
    storageKey: text(),
    contentType: text(),
    sizeBytes: integer(),
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

// ---------- auth (Phase 2) ----------
/**
 * Server-side sessions. The browser cookie holds a random 256-bit token; only its SHA-256
 * lands here, so a database read never yields a usable session. Sliding expiry is applied
 * by the auth service when a session is older than SESSION_RENEW_AFTER.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** Truncated (/24 or /48), never a full IP. */
    ipPrefix: text(),
    /** First 200 chars of the user agent; enough to show "which device" in Account. */
    userAgent: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("sessions_token_hash_idx").on(t.tokenHash),
    index("sessions_user_id_idx").on(t.userId),
    index("sessions_expires_at_idx").on(t.expiresAt),
  ],
);

/** Single-use tokens for email verification and password reset. Hash only, like sessions. */
export const authTokens = pgTable(
  "auth_tokens",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: authTokenKind().notNull(),
    tokenHash: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    usedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("auth_tokens_token_hash_idx").on(t.tokenHash),
    index("auth_tokens_user_kind_idx").on(t.userId, t.kind),
  ],
);

/**
 * Fixed-window rate-limit counters, keyed by e.g. "login:ip:203.0.113.0/24". Lives in
 * Postgres so every serverless instance shares one view; at ~20 concurrent users this is
 * plenty. Old windows are purged opportunistically by the limiter.
 */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text().notNull(),
    windowStart: timestamp({ withTimezone: true }).notNull(),
    count: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

/**
 * One row per age-verification attempt. Stores the vendor's opaque reference and outcome,
 * never the document, selfie or extracted identity data (non-negotiable #5). A pass also
 * sets users.ageVerifiedAt, which is what access checks read.
 */
export const ageVerifications = pgTable(
  "age_verifications",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** AgeVerifier implementation name, e.g. 'stub', 'verifymy'. */
    provider: text().notNull(),
    providerRef: text(),
    status: ageVerificationStatus().notNull().default("pending"),
    /** Vendor-supplied non-identifying detail (method used, failure reason code). Scrubbed by caller. */
    metadata: jsonb().$type<Record<string, unknown>>(),
    startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("age_verifications_user_idx").on(t.userId, t.startedAt),
    uniqueIndex("age_verifications_provider_ref_idx").on(t.provider, t.providerRef),
  ],
);

// ---------- playback (Phase 3) ----------
/**
 * One row per signed playback/view grant. This is the leak-tracing record: given a leaked
 * frame's watermark (handle + time) or a token, find who was issued access to what and when.
 */
export const playbackGrants = pgTable(
  "playback_grants",
  {
    id: uuid().primaryKey().defaultRandom(),
    mediaId: uuid()
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    issuedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    /** Truncated, never a full IP. */
    ipPrefix: text(),
    /** Short random id also drawn into the watermark so a frame maps to exactly one grant. */
    watermarkNonce: text().notNull(),
  },
  (t) => [
    index("playback_grants_media_idx").on(t.mediaId, t.issuedAt),
    index("playback_grants_user_idx").on(t.userId, t.issuedAt),
  ],
);

// ---------- relations (for db.query.*.findMany({ with })) ----------
export const postsRelations = relations(posts, ({ many }) => ({
  media: many(media),
}));

export const mediaRelations = relations(media, ({ one }) => ({
  post: one(posts, { fields: [media.postId], references: [posts.id] }),
}));

// ---------- payments (Phase 4) ----------
/**
 * One row per hosted-checkout redirect. Ties the processor's callback back to the user and
 * what they were buying. Card data never touches us: the processor hosts the form.
 */
export const checkoutSessions = pgTable(
  "checkout_sessions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: checkoutKind().notNull(),
    postId: uuid().references(() => posts.id, { onDelete: "set null" }),
    amountCents: integer().notNull(),
    currency: text().notNull().default("USD"),
    /** Line shown on the processor's page; discreet. */
    description: text().notNull(),
    processor: text().notNull(),
    processorRef: text(),
    status: checkoutStatus().notNull().default("pending"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index("checkout_sessions_user_idx").on(t.userId, t.createdAt)],
);

/** Idempotency ledger: a processor event id is applied at most once. */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    processor: text().notNull(),
    eventId: text().notNull(),
    type: text().notNull(),
    /** Scrubbed copy of the normalized event for support/debugging. */
    payload: jsonb().$type<Record<string, unknown>>(),
    receivedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp({ withTimezone: true }),
    error: text(),
  },
  (t) => [uniqueIndex("webhook_events_processor_event_idx").on(t.processor, t.eventId)],
);

/** Each successful subscription charge (initial and renewals), for receipts and revenue. */
export const subscriptionPayments = pgTable(
  "subscription_payments",
  {
    id: uuid().primaryKey().defaultRandom(),
    subscriptionId: uuid()
      .notNull()
      .references(() => subscriptions.id, { onDelete: "cascade" }),
    processor: text().notNull(),
    processorTransactionId: text().notNull(),
    amountCents: integer().notNull(),
    currency: text().notNull().default("USD"),
    status: paymentStatus().notNull().default("paid"),
    periodStart: timestamp({ withTimezone: true }).notNull(),
    periodEnd: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("subscription_payments_txn_idx").on(t.processor, t.processorTransactionId),
    index("subscription_payments_sub_idx").on(t.subscriptionId, t.createdAt),
  ],
);
