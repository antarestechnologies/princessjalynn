import { NextResponse } from "next/server";
import { exportIndexCsv } from "@/compliance/vault";
import { getVaultKeyring, vaultActorOrNull } from "@/compliance/vault-session";
import { getDb } from "@/db/client";

export const dynamic = "force-dynamic";

/** Full 2257 index with decrypted identity fields. Audited inside exportIndexCsv. */
export async function GET() {
  const actor = await vaultActorOrNull();
  if (!actor) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const csv = await exportIndexCsv(getDb(), getVaultKeyring(), actor);
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="2257-index-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
