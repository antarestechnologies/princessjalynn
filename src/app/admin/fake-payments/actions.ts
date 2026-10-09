"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/auth/session";
import { getDb } from "@/db/client";
import { subscriptionPayments, subscriptions } from "@/db/schema";
import { getFakeProcessor } from "@/payments";

/** Admin simulator for processor-originated events. Only exists with the fake processor. */
export async function simulateAction(form: FormData): Promise<void> {
  await requireAdmin();
  const fake = getFakeProcessor();
  if (!fake) return;
  const db = getDb();
  const op = String(form.get("op") ?? "");
  const subId = String(form.get("subscriptionId") ?? "");
  const txn = String(form.get("transactionId") ?? "");

  if (/^[0-9a-f-]{36}$/.test(subId)) {
    const sub = await db.query.subscriptions.findFirst({ where: eq(subscriptions.id, subId) });
    if (!sub) return;
    if (op === "renew") await fake.simulateRenewal(sub);
    else if (op === "fail") await fake.simulateRenewalFailed(sub.processorSubscriptionId);
    else if (op === "cancel") await fake.cancelSubscription(sub.processorSubscriptionId);
    else if (op === "expire") await fake.simulateExpired(sub.processorSubscriptionId);
    else if (op === "refund_last" || op === "chargeback_last") {
      const last = await db.query.subscriptionPayments.findFirst({
        where: eq(subscriptionPayments.subscriptionId, sub.id),
        orderBy: [desc(subscriptionPayments.createdAt)],
      });
      if (last) {
        if (op === "refund_last")
          await fake.refund({ processorTransactionId: last.processorTransactionId });
        else await fake.simulateChargeback(last.processorTransactionId);
      }
    }
  } else if (txn && /^[A-Za-z0-9_-]{1,100}$/.test(txn)) {
    if (op === "refund") await fake.refund({ processorTransactionId: txn });
    else if (op === "chargeback") await fake.simulateChargeback(txn);
  }
  revalidatePath("/admin/fake-payments");
  revalidatePath("/admin/revenue");
}
