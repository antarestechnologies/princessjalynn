import Link from "next/link";
import { listPerformers } from "@/compliance/vault";
import { requireVaultAccess } from "@/compliance/vault-session";
import { getDb } from "@/db/client";
import { Button } from "@/components/ui";
import { lockVaultAction } from "./actions";

export const metadata = { title: "Admin · 2257 vault" };

export default async function VaultPage() {
  const actor = await requireVaultAccess("/admin/vault");
  const rows = await listPerformers(getDb(), actor);
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">2257 vault</h1>
        <div className="flex items-center gap-3">
          <a
            href="/api/admin/vault/export"
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm"
          >
            Export index (CSV)
          </a>
          <Link
            href="/admin/vault/performers/new"
            className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900"
          >
            New performer record
          </Link>
          <form action={lockVaultAction}>
            <Button variant="secondary">Lock</Button>
          </form>
        </div>
      </div>
      <p className="mb-4 max-w-2xl text-xs text-amber-300">
        Structure pending attorney review. Do not store real identity documents until counsel
        approves this layout, the custodian of records is named, and VAULT_ENCRYPTION_KEY is set and
        backed up offline.
      </p>
      <table className="w-full text-sm">
        <thead className="text-left text-zinc-400">
          <tr>
            <th className="py-2">Stage name</th>
            <th>Status</th>
            <th>Documents</th>
            <th>Linked media</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-zinc-800">
              <td className="py-2">
                <Link href={`/admin/vault/performers/${r.id}`} className="underline">
                  {r.stageName}
                </Link>
              </td>
              <td className={r.status === "verified" ? "text-emerald-300" : "text-amber-300"}>
                {r.status}
              </td>
              <td>{r.documents}</td>
              <td>{r.links}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="py-6 text-center text-zinc-500">
                No records yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
