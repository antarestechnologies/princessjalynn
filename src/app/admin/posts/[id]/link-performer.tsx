"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui";
import { linkPerformerAction, type AdminActionState } from "../actions";

export function LinkPerformerForm({
  mediaId,
  postId,
  performers,
}: {
  mediaId: string;
  postId: string;
  performers: { id: string; stageName: string }[];
}) {
  const [state, action] = useActionState<AdminActionState, FormData>(linkPerformerAction, {});
  if (performers.length === 0) {
    return (
      <p className="text-[11px] text-amber-300">
        No verified 2257 records. Create one in the vault.
      </p>
    );
  }
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="mediaId" value={mediaId} />
      <input type="hidden" name="postId" value={postId} />
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <select
        name="performerId"
        className="w-full rounded border border-zinc-700 bg-zinc-950 px-1 py-0.5 text-[11px]"
      >
        {performers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.stageName}
          </option>
        ))}
      </select>
      <input
        type="date"
        name="productionDate"
        required
        className="w-full rounded border border-zinc-700 bg-zinc-950 px-1 py-0.5 text-[11px]"
        aria-label="Date produced"
      />
      <button
        type="submit"
        className="w-full rounded border border-zinc-600 px-1 py-0.5 text-[11px] hover:bg-zinc-800"
      >
        Link 2257 record
      </button>
    </form>
  );
}
