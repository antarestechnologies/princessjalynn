"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/auth/session";
import { updateTakedown } from "@/compliance/takedowns";
import { getDb } from "@/db/client";

export async function updateTakedownAction(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "reviewing") as
    "new" | "reviewing" | "actioned" | "rejected";
  if (!/^[0-9a-f-]{36}$/.test(id)) return;
  await updateTakedown(getDb(), admin.id, id, {
    status,
    resolutionNotes: String(form.get("resolutionNotes") ?? ""),
    assignToMe: form.get("assignToMe") === "on",
  });
  revalidatePath(`/admin/takedowns/${id}`);
  revalidatePath("/admin/takedowns");
}
