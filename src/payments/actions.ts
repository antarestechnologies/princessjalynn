"use server";

import { redirect } from "next/navigation";
import { requireVerifiedUser } from "@/auth/session";
import { getDb } from "@/db/client";
import { logger } from "@/lib/logger";
import { getPaymentProcessor, paymentDeps } from "@/payments";
import { cancelOwnSubscription, startCheckout } from "./service";

export interface PayActionState {
  error?: string;
  ok?: boolean;
}

const MESSAGES: Record<string, string> = {
  already_subscribed: "You already have an active membership.",
  already_purchased: "You already own this item.",
  post_not_ppv: "This item cannot be purchased.",
  bad_amount: "Enter an amount between $1 and $500.",
  processor_error: "The payment provider is unavailable right now. Please try again shortly.",
};

export async function subscribeAction(): Promise<PayActionState> {
  const user = await requireVerifiedUser("/subscribe");
  const r = await startCheckout(getDb(), getPaymentProcessor(), paymentDeps(), {
    user,
    kind: "subscription",
  });
  if (!r.ok) return { error: MESSAGES[r.error] };
  redirect(r.redirectUrl);
}

export async function unlockPostAction(
  _prev: PayActionState,
  form: FormData,
): Promise<PayActionState> {
  const postId = String(form.get("postId") ?? "");
  const user = await requireVerifiedUser(`/p/${postId}`);
  if (!/^[0-9a-f-]{36}$/.test(postId)) return { error: MESSAGES.post_not_ppv };
  const r = await startCheckout(getDb(), getPaymentProcessor(), paymentDeps(), {
    user,
    kind: "ppv",
    postId,
  });
  if (!r.ok) return { error: MESSAGES[r.error] };
  redirect(r.redirectUrl);
}

export async function tipAction(_prev: PayActionState, form: FormData): Promise<PayActionState> {
  const postId = String(form.get("postId") ?? "");
  const user = await requireVerifiedUser(postId ? `/p/${postId}` : "/feed");
  const dollars = Number(String(form.get("amount") ?? "").replace(/[^0-9.]/g, ""));
  const amountCents = Math.round(dollars * 100);
  const r = await startCheckout(getDb(), getPaymentProcessor(), paymentDeps(), {
    user,
    kind: "tip",
    postId: /^[0-9a-f-]{36}$/.test(postId) ? postId : undefined,
    amountCents,
  });
  if (!r.ok) return { error: MESSAGES[r.error] };
  redirect(r.redirectUrl);
}

export async function cancelSubscriptionAction(): Promise<PayActionState> {
  const user = await requireVerifiedUser("/account/billing");
  try {
    const r = await cancelOwnSubscription(getDb(), getPaymentProcessor(), user.id);
    if (r === "none") return { error: "There is no active membership to cancel." };
  } catch (err) {
    logger.error({ err }, "cancel subscription failed");
    return { error: "Could not reach the payment provider. Please try again." };
  }
  redirect("/account/billing?canceled=1");
}
