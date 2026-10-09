"use server";

import { redirect } from "next/navigation";
import { deleteAccount } from "@/account/privacy";
import { clearSessionCookie, getCurrentUser, requestMeta } from "@/auth/session";
import { getDb } from "@/db/client";
import { consumeRateLimit, RATE_RULES } from "@/lib/rate-limit";
import { getPaymentProcessor } from "@/payments";

export interface DeleteState {
  error?: string;
}

export async function deleteAccountAction(
  _prev: DeleteState,
  form: FormData,
): Promise<DeleteState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Faccount%2Fprivacy");
  if (String(form.get("confirm") ?? "").trim() !== "DELETE")
    return { error: "Type DELETE to confirm." };
  const db = getDb();
  const rl = await consumeRateLimit(db, `delete:user:${user.id}`, RATE_RULES.accountDeletePerUser);
  if (!rl.allowed) return { error: "Too many attempts. Try again later." };
  const r = await deleteAccount(
    db,
    getPaymentProcessor(),
    { userId: user.id, password: String(form.get("password") ?? "") },
    await requestMeta(),
  );
  if (!r.ok) {
    return {
      error:
        r.error === "bad_password"
          ? "Incorrect password."
          : r.error === "admin_account"
            ? "Admin accounts cannot be deleted here."
            : r.error === "processor_error"
              ? "We could not cancel your membership with the payment provider, so nothing was deleted. Please try again."
              : "Account not found.",
    };
  }
  await clearSessionCookie();
  redirect("/?deleted=1");
}
