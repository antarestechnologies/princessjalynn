import "server-only";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db/client";
import { clientIpPrefix, shortUserAgent } from "@/lib/request-meta";
import { getSessionUser, type RequestMeta, type SessionUser } from "./service";

export const SESSION_COOKIE = "sid";

export async function setSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function readSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/** Request metadata for audit rows and session records. */
export async function requestMeta(): Promise<RequestMeta> {
  const h = await headers();
  return { ipPrefix: clientIpPrefix(h), userAgent: shortUserAgent(h) };
}

/** Memoized per request. Null when signed out or the session is gone. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = await readSessionToken();
  if (!token) return null;
  const found = await getSessionUser(getDb(), token);
  return found?.user ?? null;
});

/** Redirects to login when signed out. `next` keeps the destination. */
export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return user;
}

/**
 * The bar for anything paid or explicit (Phase 3 content routes use this): signed in,
 * email confirmed, and age verified by the third-party vendor.
 */
export async function requireVerifiedUser(next?: string): Promise<SessionUser> {
  const user = await requireUser(next);
  if (!user.emailVerifiedAt) redirect("/verify-email/sent");
  if (!user.ageVerifiedAt) redirect("/verify-age");
  return user;
}

/** Admin routes 404 for everyone else so their existence is not advertised. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") notFound();
  return user;
}
