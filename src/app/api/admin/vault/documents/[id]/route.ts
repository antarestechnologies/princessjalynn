import { NextResponse, type NextRequest } from "next/server";
import { readDocument } from "@/compliance/vault";
import { getVaultKeyring, vaultActorOrNull } from "@/compliance/vault-session";
import { getDb } from "@/db/client";

export const dynamic = "force-dynamic";

/** Decrypted download for the custodian. Audited inside readDocument. Never cached. */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = await vaultActorOrNull();
  if (!actor) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const doc = await readDocument(getDb(), getVaultKeyring(), actor, id);
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const ext =
    doc.contentType === "application/pdf" ? "pdf" : doc.contentType === "image/png" ? "png" : "jpg";
  return new NextResponse(new Uint8Array(doc.data), {
    headers: {
      "content-type": doc.contentType,
      "content-disposition": `attachment; filename="${doc.kind}-${id.slice(0, 8)}.${ext}"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
