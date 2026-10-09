import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { deriveKey } from "@/lib/crypto";
import {
  type CreateCheckoutInput,
  envelopeSchema,
  type NormalizedEvent,
  type NormalizedEventBody,
  type PaymentProcessor,
  WebhookSignatureError,
} from "./types";

/**
 * In-app stand-in for CCBill/Segpay. It has no server of its own: "hosted checkout" is our
 * /pay/fake page, and every outcome is delivered as a signed webhook through the same
 * ingest path a real processor would hit, so the state machine, idempotency and signature
 * checks are exercised for real. Refused in production unless ALLOW_FAKE_PAYMENTS=true.
 */
export type WebhookDeliverer = (input: { headers: Headers; rawBody: string }) => Promise<void>;

const SIG_HEADER = "x-fake-signature";
const TS_HEADER = "x-fake-timestamp";
const MAX_SKEW_SECONDS = 5 * 60;

export class FakePaymentProcessor implements PaymentProcessor {
  readonly name = "fake";
  private readonly key: Buffer;
  constructor(
    secret: string,
    private readonly appUrl: string,
    private readonly deliver: WebhookDeliverer,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.key = deriveKey(secret, "fake-payments-webhook-v1");
  }

  async createCheckout(input: CreateCheckoutInput) {
    const url = new URL(`/pay/fake/${input.checkoutId}`, this.appUrl);
    return { redirectUrl: url.toString(), processorRef: `fake_co_${input.checkoutId}` };
  }

  sign(timestamp: string, rawBody: string): string {
    return createHmac("sha256", this.key).update(`${timestamp}.${rawBody}`).digest("hex");
  }

  async parseWebhook({
    headers,
    rawBody,
  }: {
    headers: Headers;
    rawBody: string;
  }): Promise<NormalizedEvent[]> {
    const ts = headers.get(TS_HEADER) ?? "";
    const sig = headers.get(SIG_HEADER) ?? "";
    const tsNum = Number(ts);
    if (
      !Number.isInteger(tsNum) ||
      Math.abs(this.now().getTime() / 1000 - tsNum) > MAX_SKEW_SECONDS
    ) {
      throw new WebhookSignatureError("stale or missing timestamp");
    }
    const expected = this.sign(ts, rawBody);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new WebhookSignatureError();
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      throw new WebhookSignatureError("body is not JSON");
    }
    const parsed = envelopeSchema.safeParse(json);
    if (!parsed.success) throw new WebhookSignatureError("unrecognized event shape");
    return [parsed.data as NormalizedEvent];
  }

  async cancelSubscription(processorSubscriptionId: string): Promise<void> {
    await this.emit({ type: "subscription.canceled", data: { processorSubscriptionId } });
  }

  async refund(input: { processorTransactionId: string; amountCents?: number }): Promise<void> {
    await this.emit({
      type: "payment.refunded",
      data: { transactionId: input.processorTransactionId, amountCents: input.amountCents },
    });
  }

  /** Builds a signed delivery for an event and pushes it through the ingest path. */
  async emit(body: NormalizedEventBody, id = randomUUID()): Promise<NormalizedEvent> {
    const event: NormalizedEvent = { id, occurredAt: this.now().toISOString(), ...body };
    const rawBody = JSON.stringify(event);
    const ts = String(Math.floor(this.now().getTime() / 1000));
    const headers = new Headers({
      [TS_HEADER]: ts,
      [SIG_HEADER]: this.sign(ts, rawBody),
      "content-type": "application/json",
    });
    await this.deliver({ headers, rawBody });
    return event;
  }

  // ----- simulator helpers used by the fake pay page and the admin console -----
  static subscriptionIdFor(checkoutId: string) {
    return `fake_sub_${checkoutId}`;
  }
  static txn() {
    return `fake_txn_${randomUUID().slice(0, 8)}`;
  }

  async simulateCheckoutPaid(checkout: {
    id: string;
    kind: "subscription" | "ppv" | "tip";
    amountCents: number;
    currency: string;
    userId: string;
  }) {
    const start = this.now();
    if (checkout.kind === "subscription") {
      const end = new Date(start.getTime() + 30 * 24 * 3600 * 1000);
      return this.emit({
        type: "subscription.created",
        data: {
          checkoutId: checkout.id,
          processorSubscriptionId: FakePaymentProcessor.subscriptionIdFor(checkout.id),
          processorCustomerId: `fake_cus_${checkout.userId}`,
          transactionId: FakePaymentProcessor.txn(),
          periodStart: start.toISOString(),
          periodEnd: end.toISOString(),
          amountCents: checkout.amountCents,
          currency: checkout.currency,
        },
      });
    }
    return this.emit({
      type: "purchase.completed",
      data: {
        checkoutId: checkout.id,
        transactionId: FakePaymentProcessor.txn(),
        amountCents: checkout.amountCents,
        currency: checkout.currency,
      },
    });
  }

  async simulateRenewal(sub: {
    processorSubscriptionId: string;
    currentPeriodEnd: Date;
    priceCents: number;
    currency: string;
  }) {
    const start = sub.currentPeriodEnd;
    const end = new Date(start.getTime() + 30 * 24 * 3600 * 1000);
    return this.emit({
      type: "subscription.renewed",
      data: {
        processorSubscriptionId: sub.processorSubscriptionId,
        transactionId: FakePaymentProcessor.txn(),
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
        amountCents: sub.priceCents,
        currency: sub.currency,
      },
    });
  }

  simulateRenewalFailed(processorSubscriptionId: string) {
    return this.emit({
      type: "subscription.renewal_failed",
      data: { processorSubscriptionId, reason: "card_declined" },
    });
  }
  simulateExpired(processorSubscriptionId: string) {
    return this.emit({ type: "subscription.expired", data: { processorSubscriptionId } });
  }
  simulateChargeback(transactionId: string) {
    return this.emit({ type: "payment.chargeback", data: { transactionId, reasonCode: "10.4" } });
  }
}
