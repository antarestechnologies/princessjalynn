import { notFound } from "next/navigation";
import { getTakedown } from "@/compliance/takedowns";
import { getDb } from "@/db/client";
import { Button } from "@/components/ui";
import { updateTakedownAction } from "../actions";

export const metadata = { title: "Admin · Content report" };

export default async function TakedownPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await getTakedown(getDb(), id);
  if (!r) notFound();
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Content report</h1>
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-zinc-400">Received</dt>
          <dd>{r.createdAt.toISOString()}</dd>
        </div>
        <div>
          <dt className="text-zinc-400">Reporter</dt>
          <dd>
            {r.reporterName} · {r.reporterEmail} · {r.reporterRelationship}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-400">Good-faith statement</dt>
          <dd>{r.goodFaithAttested ? "Confirmed" : "Not confirmed"}</dd>
        </div>
        <div>
          <dt className="text-zinc-400">Links</dt>
          <dd>
            <ul className="list-disc pl-5">
              {r.contentUrls.map((u) => (
                <li key={u} className="break-all font-mono text-xs">
                  {u}
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt className="text-zinc-400">Description</dt>
          <dd className="whitespace-pre-wrap">{r.description}</dd>
        </div>
      </dl>
      <form
        action={updateTakedownAction}
        className="space-y-3 rounded-lg border border-zinc-800 p-4"
      >
        <input type="hidden" name="id" value={r.id} />
        <label className="block text-sm text-zinc-300">
          Status
          <select
            name="status"
            defaultValue={r.status}
            className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
          >
            <option value="new">New</option>
            <option value="reviewing">Reviewing</option>
            <option value="actioned">Actioned (content removed or changed)</option>
            <option value="rejected">Rejected (no action)</option>
          </select>
        </label>
        <label className="block text-sm text-zinc-300">
          Notes (what was done and why)
          <textarea
            name="resolutionNotes"
            rows={4}
            defaultValue={r.resolutionNotes ?? ""}
            className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input type="checkbox" name="assignToMe" /> Assign to me
        </label>
        <Button>Save</Button>
      </form>
      <p className="text-xs text-zinc-500">
        To remove content, open the post in Admin → Posts and unpublish or archive it, then mark
        this report actioned.
      </p>
    </div>
  );
}
