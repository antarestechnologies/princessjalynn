"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui";
import { linkAllAction, type AdminActionState } from "../actions";

/** One step for a whole shoot: link every unlinked item on the post to one performer and date. */
export function LinkAllForm({
  postId,
  performers,
}: {
  postId: string;
  performers: { id: string; stageName: string }[];
}) {
  const [state, action] = useActionState<AdminActionState, FormData>(linkAllAction, {});
  if (!performers.length) return null;
  return (
    <form
      action={action}
      className="mb-4 flex max-w-xl flex-wrap items-end gap-2 rounded-lg border border-zinc-800 p-3"
    >
      <input type="hidden" name="postId" value={postId} />
      <label className="text-xs text-zinc-300">
        Performer
        <select
          name="performerId"
          className="mt-1 block rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
        >
          {performers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.stageName}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-zinc-300">
        Produced on
        <input
          type="date"
          name="productionDate"
          required
          className="mt-1 block rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
        />
      </label>
      <div className="w-56">
        <SubmitButton pendingText="Linking…">Link all unlinked items</SubmitButton>
      </div>
      {state.error && (
        <div className="basis-full">
          <Alert kind="error">{state.error}</Alert>
        </div>
      )}
      {state.ok && <p className="basis-full text-xs text-emerald-300">Linked.</p>}
    </form>
  );
}
