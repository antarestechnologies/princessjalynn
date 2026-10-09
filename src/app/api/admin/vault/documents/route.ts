import { NextResponse, type NextRequest } from "next/server";
import { addDocument } from "@/compliance/vault";
import { getVaultKeyring, vaultActorOrNull } from "@/compliance/vault-session";
import { getDb } from "@/db/client";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const KINDS = new Set([
  "id_front",
  "id_back",
  "selfie_with_id",
  "model_release",
  "consent",
  "other",
]);

/** Multipart upload from the performer page. Bytes are encrypted before they reach the database. */
export async function POST(request: NextRequest) {
  const actor = await vaultActorOrNull();
  if (!actor) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "bad_form" }, { status: 400 });
  }
  const performerId = String(form.get("performerId") ?? "");
  const kind = String(form.get("kind") ?? "");
  const file = form.get("file");
  if (!/^[0-9a-f-]{36}$/.test(performerId) || !KINDS.has(kind) || !(file instanceof File)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const back = new URL(`/admin/vault/performers/${performerId}`, request.nextUrl);
  try {
    const r = await addDocument(getDb(), getVaultKeyring(), actor, {
      performerId,
      kind: kind as Parameters<typeof addDocument>[3]["kind"],
      data: Buffer.from(await file.arrayBuffer()),
    });
    back.searchParams.set(r.ok ? "uploaded" : "error", r.ok ? "1" : r.error);
  } catch (err) {
    // Never log the file or its name; only the failure.
    logger.error({ err: err instanceof Error ? err.message : "unknown" }, "vault upload failed");
    back.searchParams.set("error", "failed");
  }
  return NextResponse.redirect(back, 303);
}
