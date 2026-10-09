"use client";

import { useActionState } from "react";
import {
  cancelSubscriptionAction,
  subscribeAction,
  tipAction,
  unlockPostAction,
  type PayActionState,
} from "@/payments/actions";
import { SubmitButton } from "./submit-button";
import { Alert } from "./ui";

export function SubscribeButton({ label }: { label: string }) {
  const [state, action] = useActionState<PayActionState, FormData>(subscribeAction, {});
  return (
    <form action={action}>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <SubmitButton pendingText="Redirecting…">{label}</SubmitButton>
    </form>
  );
}

export function UnlockButton({ postId, label }: { postId: string; label: string }) {
  const [state, action] = useActionState<PayActionState, FormData>(unlockPostAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="postId" value={postId} />
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <SubmitButton pendingText="Redirecting…">{label}</SubmitButton>
    </form>
  );
}

export function TipForm({ postId }: { postId?: string }) {
  const [state, action] = useActionState<PayActionState, FormData>(tipAction, {});
  return (
    <form action={action} className="flex items-end gap-2">
      {postId && <input type="hidden" name="postId" value={postId} />}
      <label className="text-sm text-zinc-300">
        Tip (USD)
        <input
          name="amount"
          type="number"
          min={1}
          max={500}
          step="1"
          defaultValue={5}
          className="mt-1 block w-28 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
        />
      </label>
      <div className="w-32">
        <SubmitButton pendingText="…">Send tip</SubmitButton>
      </div>
      {state.error && (
        <div className="basis-full">
          <Alert kind="error">{state.error}</Alert>
        </div>
      )}
    </form>
  );
}

export function CancelSubscriptionButton() {
  const [state, action] = useActionState<PayActionState, FormData>(cancelSubscriptionAction, {});
  return (
    <form action={action}>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <SubmitButton pendingText="Cancelling…">Cancel membership</SubmitButton>
    </form>
  );
}
