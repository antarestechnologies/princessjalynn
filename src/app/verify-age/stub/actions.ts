"use server";

import { redirect } from "next/navigation";
import { completeAgeVerification } from "@/age-verification/service";
import { getCurrentUser } from "@/auth/session";
import { getDb } from "@/db/client";
import { getEnv } from "@/env";

function stubAllowed() {
  const env = getEnv();
  return (
    env.AGE_VERIFIER === "stub" && (env.NODE_ENV !== "production" || env.ALLOW_STUB_AGE_VERIFIER)
  );
}

export async function stubCompleteAction(form: FormData): Promise<void> {
  if (!stubAllowed()) redirect("/verify-age");
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const verificationId = String(form.get("v") ?? "");
  const outcome = form.get("outcome") === "passed" ? "passed" : "failed";
  if (!/^[0-9a-f-]{36}$/.test(verificationId)) redirect("/verify-age");
  await completeAgeVerification(getDb(), {
    verificationId,
    userId: user.id,
    outcome,
    providerRef: `stub-${verificationId}`,
    metadata: { method: "stub_button" },
  });
  redirect(outcome === "passed" ? "/account?verified=1" : "/verify-age?failed=1");
}
