import { z } from "zod";

/**
 * Payment processor boundary (PLAN.md Phase 4). The site never sees card data: the
 * processor hosts checkout, then tells us what happened through signed webhooks. Every
 * adapter normalizes its vendor's events into the small vocabulary below, and the state
 * machine in service.ts is the only code that touches subscriptions/purchases/entitlements.
 */

export const checkoutKinds = ["subscription", "ppv", "tip"] as const;
export type CheckoutKind = (typeof checkoutKinds)[number];

export interface CreateCheckoutInput {
  checkoutId: string;
  kind: CheckoutKind;
  userId: string;
  /** Opaque, stable per user; many processors want it for their customer record. */
  userRef: string;
  amountCents: number;
  currency: string;
  /** Discreet line shown on the processor page. */
  description: string;
  /** Where the processor sends the fan afterwards. */
  returnUrl: string;
  cancelUrl: string;
}

export interface PaymentProcessor {
  readonly name: string;
  createCheckout(
    input: CreateCheckoutInput,
  ): Promise<{ redirectUrl: string; processorRef?: string }>;
  /**
   * Verify the signature and translate the raw webhook into normalized events. Throws
   * WebhookSignatureError on a bad signature; the route answers 400 and nothing is applied.
   */
  parseWebhook(input: { headers: Headers; rawBody: string }): Promise<NormalizedEvent[]>;
  /** Stop renewals at the processor. Access continues until the paid period ends. */
  cancelSubscription(processorSubscriptionId: string): Promise<void>;
  /** Refund a transaction (full or partial). The resulting event arrives via webhook. */
  refund(input: { processorTransactionId: string; amountCents?: number }): Promise<void>;
}

export class WebhookSignatureError extends Error {
  constructor(message = "invalid webhook signature") {
    super(message);
    this.name = "WebhookSignatureError";
  }
}

// ---------- normalized events ----------
const money = {
  amountCents: z.number().int().nonnegative(),
  currency: z.string().length(3).default("USD"),
};
const iso = z.string().datetime({ offset: true });

export const normalizedEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("subscription.created"),
    data: z.object({
      checkoutId: z.string().uuid(),
      processorSubscriptionId: z.string().min(1),
      processorCustomerId: z.string().optional(),
      transactionId: z.string().min(1),
      periodStart: iso,
      periodEnd: iso,
      ...money,
    }),
  }),
  z.object({
    type: z.literal("subscription.renewed"),
    data: z.object({
      processorSubscriptionId: z.string().min(1),
      transactionId: z.string().min(1),
      periodStart: iso,
      periodEnd: iso,
      ...money,
    }),
  }),
  z.object({
    type: z.literal("subscription.renewal_failed"),
    data: z.object({ processorSubscriptionId: z.string().min(1), reason: z.string().optional() }),
  }),
  z.object({
    type: z.literal("subscription.canceled"),
    data: z.object({ processorSubscriptionId: z.string().min(1) }),
  }),
  z.object({
    type: z.literal("subscription.expired"),
    data: z.object({ processorSubscriptionId: z.string().min(1) }),
  }),
  z.object({
    type: z.literal("purchase.completed"),
    data: z.object({ checkoutId: z.string().uuid(), transactionId: z.string().min(1), ...money }),
  }),
  z.object({
    type: z.literal("payment.refunded"),
    data: z.object({
      transactionId: z.string().min(1),
      amountCents: z.number().int().nonnegative().optional(),
    }),
  }),
  z.object({
    type: z.literal("payment.chargeback"),
    data: z.object({ transactionId: z.string().min(1), reasonCode: z.string().optional() }),
  }),
]);

export type NormalizedEventBody = z.infer<typeof normalizedEventSchema>;
export type NormalizedEvent = NormalizedEventBody & { id: string; occurredAt: string };
export type EventType = NormalizedEventBody["type"];

export const envelopeSchema = z
  .object({ id: z.string().min(1).max(200), occurredAt: iso })
  .and(normalizedEventSchema);
