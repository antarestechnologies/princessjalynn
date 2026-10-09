import { getDb } from "@/db/client";
import { getEnv } from "@/env";
import { getSessionSecret } from "@/lib/age-gate";
import { getMailer } from "@/lib/mailer";
import { FakePaymentProcessor } from "./fake";
import { ingestWebhook, type PaymentDeps } from "./service";
import type { PaymentProcessor } from "./types";

let cached: PaymentProcessor | undefined;

export function paymentDeps(): PaymentDeps {
  const env = getEnv();
  return {
    mailer: getMailer(),
    config: {
      subscriptionPriceCents: env.SUBSCRIPTION_PRICE_CENTS,
      currency: "USD",
      billingDescriptor: env.BILLING_DESCRIPTOR,
      gracePeriodDays: env.GRACE_PERIOD_DAYS,
      appUrl: env.APP_URL,
    },
  };
}

export function fakePaymentsAllowed(): boolean {
  const env = getEnv();
  return (
    env.PAYMENT_PROCESSOR === "fake" && (env.NODE_ENV !== "production" || env.ALLOW_FAKE_PAYMENTS)
  );
}

export function getPaymentProcessor(): PaymentProcessor {
  if (cached) return cached;
  const env = getEnv();
  switch (env.PAYMENT_PROCESSOR) {
    case "fake": {
      // The fake processor "calls our webhook" by invoking the same ingest function the HTTP
      // route uses, with a real signature, so nothing is skipped.
      const fake = new FakePaymentProcessor(getSessionSecret(), env.APP_URL, async (input) => {
        await ingestWebhook(getDb(), fake, paymentDeps(), input);
      });
      cached = fake;
      break;
    }
  }
  return cached;
}

/** Only the fake processor exposes a simulator; typed accessor for the dev pages. */
export function getFakeProcessor(): FakePaymentProcessor | null {
  const p = getPaymentProcessor();
  return p instanceof FakePaymentProcessor && fakePaymentsAllowed() ? p : null;
}

export function setPaymentProcessorForTests(p: PaymentProcessor | undefined) {
  cached = p;
}

/** Processors by webhook path segment. Unknown names 404 at the route. */
export function processorForWebhook(name: string): PaymentProcessor | null {
  const p = getPaymentProcessor();
  return p.name === name ? p : null;
}

export type { PaymentProcessor } from "./types";
