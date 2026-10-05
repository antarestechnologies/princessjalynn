"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createGateCookieValue,
  GATE_COOKIE,
  GATE_MAX_AGE_SECONDS,
  getSessionSecret,
  safeNextPath,
} from "@/lib/age-gate";

export async function enterGateAction(form: FormData): Promise<void> {
  if (form.get("confirm") !== "yes") redirect("/gate");
  const store = await cookies();
  store.set(GATE_COOKIE, createGateCookieValue(getSessionSecret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GATE_MAX_AGE_SECONDS,
  });
  redirect(safeNextPath(String(form.get("next") ?? "")));
}
