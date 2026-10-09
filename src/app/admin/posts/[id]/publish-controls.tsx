"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui";
import { publishPostAction, type AdminActionState } from "../actions";

export function PublishControls({
  postId,
  status,
  readyCount,
}: {
  postId: string;
  status: string;
  readyCount: number;
}) {
  const [state, action] = useActionState<AdminActionState, FormData>(publishPostAction, {});
  return (
    <form action={action} className="max-w-md space-y-3">
      <input type="hidden" name="id" value={postId} />
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && <Alert kind="success">Done.</Alert>}
      <label className="block text-sm text-zinc-300">
        Schedule (leave empty to publish now)
        <input
          type="datetime-local"
          name="publishAt"
          className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
        />
      </label>
      <SubmitButton pendingText="Working…">
        {status === "published" ? "Re-publish / reschedule" : "Publish"}
      </SubmitButton>
      {readyCount === 0 && (
        <p className="text-xs text-amber-300">Add at least one finished media item first.</p>
      )}
    </form>
  );
}
