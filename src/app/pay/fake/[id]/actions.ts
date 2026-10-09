"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireUser } from "@/auth/session";
import { getDb } from "@/db/client";
import { checkoutSessions } from "@/db/schema";
import { getFakeProcessor } from "@/payments";

/** The fake processor's "hosted page" outcome buttons. */
export async function fakeCheckoutAction(form: FormData): Promise<void> {
  const fake = getFakeProcessor();
  if (!fake) redirect("/feed");
  const user = await requireUser("/feed");
  const id = String(form.get("checkoutId") ?? "");
  const outcome = form.get("outcome") === "paid" ? "paid" : "declined";
  const db = getDb();
  const checkout = /^[0-9a-f-]{36}$/.test(id)
    ? await db.query.checkoutSessions.findFirst({ where: eq(checkoutSessions.id, id) })
    : null;
  if (!checkout || checkout.userId !== user.id || checkout.status !== "pending") redirect("/feed");
  if (outcome === "paid") {
    await fake.simulateCheckoutPaid(checkout);
    redirect(`/checkout/return?c=${checkout.id}`);
  }
  await db
    .update(checkoutSessions)
    .set({ status: "abandoned" })
    .where(eq(checkoutSessions.id, checkout.id));
  redirect(`/checkout/return?c=${checkout.id}&canceled=1`);
}
