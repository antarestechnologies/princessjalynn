import Link from "next/link";
import { listTakedowns } from "@/compliance/takedowns";
import { getDb } from "@/db/client";

export const metadata = { title: "Admin · Content reports" };

export default async function TakedownsPage() {
  const rows = await listTakedowns(getDb());
  const open = rows.filter((r) => r.status === "new" || r.status === "reviewing").length;
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Content reports</h1>
      <p className="mb-4 text-sm text-zinc-400">
        {open} open. Act on reports about non-consensual content immediately: unpublish first,
        investigate second.
      </p>
      <table className="w-full text-sm">
        <thead className="text-left text-zinc-400">
          <tr>
            <th className="py-2">Received</th>
            <th>Reporter is</th>
            <th>Links</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-zinc-800">
              <td className="py-2">
                <Link href={`/admin/takedowns/${r.id}`} className="underline">
                  {r.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                </Link>
              </td>
              <td className={r.reporterRelationship === "depicted_person" ? "text-red-300" : ""}>
                {r.reporterRelationship}
              </td>
              <td>{r.contentUrls.length}</td>
              <td className={r.status === "new" ? "text-amber-300" : "text-zinc-400"}>
                {r.status}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="py-6 text-center text-zinc-500">
                No reports.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
