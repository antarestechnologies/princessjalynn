"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { recordAudit } from "@/auth/audit";
import { requestMeta, requireAdmin } from "@/auth/session";
import {
  createPerformer,
  markVerified,
  performerInputSchema,
  updatePerformer,
} from "@/compliance/vault";
import { getVaultKeyring, requireVaultAccess } from "@/compliance/vault-session";
import {
  createVaultUnlockValue,
  VAULT_COOKIE,
  VAULT_UNLOCK_SECONDS,
} from "@/compliance/vault-unlock";
import { getDb } from "@/db/client";
import { getSessionSecret, safeNextPath } from "@/lib/age-gate";
import { verifyPassword } from "@/lib/crypto";
import { consumeRateLimit, RATE_RULES } from "@/lib/rate-limit";

export interface VaultState {
  error?: string;
  fieldErrors?: Record<string, string>;
  ok?: boolean;
}

export async function unlockVaultAction(_prev: VaultState, form: FormData): Promise<VaultState> {
  const admin = await requireAdmin();
  const db = getDb();
  const meta = await requestMeta();
  const rl = await consumeRateLimit(
    db,
    `vault-unlock:user:${admin.id}`,
    RATE_RULES.vaultUnlockPerUser,
  );
  if (!rl.allowed) return { error: "Too many attempts. Wait 15 minutes." };
  const ok = await verifyPassword(String(form.get("password") ?? ""), admin.passwordHash);
  await recordAudit(db, {
    actorUserId: admin.id,
    action: ok ? "vault.unlock" : "vault.unlock.failed",
    targetType: "vault",
    ipPrefix: meta.ipPrefix,
  });
  if (!ok) return { error: "Incorrect password." };
  (await cookies()).set(VAULT_COOKIE, createVaultUnlockValue(getSessionSecret(), admin.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: VAULT_UNLOCK_SECONDS,
  });
  const next = safeNextPath(String(form.get("next") ?? "/admin/vault"));
  redirect(next.startsWith("/admin/vault") ? next : "/admin/vault");
}

export async function lockVaultAction(): Promise<void> {
  const admin = await requireAdmin();
  (await cookies()).delete(VAULT_COOKIE);
  await recordAudit(getDb(), { actorUserId: admin.id, action: "vault.lock", targetType: "vault" });
  redirect("/admin/posts");
}

function performerFromForm(form: FormData) {
  return performerInputSchema.safeParse({
    stageName: form.get("stageName"),
    pii: {
      legalName: form.get("legalName"),
      aliases: String(form.get("aliases") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      dateOfBirth: form.get("dateOfBirth"),
      idType: form.get("idType"),
      idNumber: form.get("idNumber"),
      idIssuer: form.get("idIssuer"),
      idExpiration: form.get("idExpiration") ?? "",
      notes: form.get("notes") ?? "",
    },
  });
}

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path.at(-1) ?? "form")] ??= i.message;
  return out;
}

export async function createPerformerAction(
  _prev: VaultState,
  form: FormData,
): Promise<VaultState> {
  const actor = await requireVaultAccess("/admin/vault/performers/new");
  const parsed = performerFromForm(form);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  const id = await createPerformer(getDb(), getVaultKeyring(), actor, parsed.data);
  redirect(`/admin/vault/performers/${id}`);
}

export async function updatePerformerAction(
  _prev: VaultState,
  form: FormData,
): Promise<VaultState> {
  const id = String(form.get("id") ?? "");
  const actor = await requireVaultAccess(`/admin/vault/performers/${id}`);
  const parsed = performerFromForm(form);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  await updatePerformer(getDb(), getVaultKeyring(), actor, id, parsed.data);
  return { ok: true };
}

export async function verifyPerformerAction(
  _prev: VaultState,
  form: FormData,
): Promise<VaultState> {
  const id = String(form.get("id") ?? "");
  const actor = await requireVaultAccess(`/admin/vault/performers/${id}`);
  const r = await markVerified(getDb(), getVaultKeyring(), actor, id);
  if (!r.ok) {
    return {
      error:
        r.error === "needs_id_document"
          ? "Upload the front of a government ID first."
          : r.error === "underage"
            ? "The recorded date of birth makes this person under 18. They cannot be verified."
            : "Record not found.",
    };
  }
  return { ok: true };
}
