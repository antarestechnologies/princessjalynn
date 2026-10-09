import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, requestMeta } from "@/auth/session";
import { getEnv } from "@/env";
import { getSessionSecret } from "@/lib/age-gate";
import type { Actor } from "./vault";
import { keyringFromEnv } from "./vault-crypto";
import { VAULT_COOKIE, verifyVaultUnlockValue } from "./vault-unlock";

export function getVaultKeyring() {
  return keyringFromEnv(getEnv(), getSessionSecret());
}

/**
 * Admin session + password re-entry within the last 10 minutes. Non-admins get a 404 so the
 * vault's existence is not advertised; admins without a fresh unlock go to the unlock page.
 */
export async function requireVaultAccess(next = "/admin/vault"): Promise<Actor> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") notFound();
  const value = (await cookies()).get(VAULT_COOKIE)?.value;
  if (!verifyVaultUnlockValue(value, getSessionSecret(), user.id)) {
    redirect(`/admin/vault/unlock?next=${encodeURIComponent(next)}`);
  }
  const meta = await requestMeta();
  return { userId: user.id, ipPrefix: meta.ipPrefix };
}

/** Same check for route handlers: returns null instead of redirecting. */
export async function vaultActorOrNull(): Promise<Actor | null> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return null;
  const value = (await cookies()).get(VAULT_COOKIE)?.value;
  if (!verifyVaultUnlockValue(value, getSessionSecret(), user.id)) return null;
  const meta = await requestMeta();
  return { userId: user.id, ipPrefix: meta.ipPrefix };
}
