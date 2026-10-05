"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field } from "@/components/ui";
import type { AdminActionState } from "./actions";

type PostLike = {
  id?: string;
  title: string;
  caption: string | null;
  tier: string;
  priceCents: number | null;
};

export function PostForm({
  action,
  post,
  submitLabel,
}: {
  action: (prev: AdminActionState, form: FormData) => Promise<AdminActionState>;
  post?: PostLike;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<AdminActionState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={formAction} noValidate className="max-w-xl">
      {post?.id && <input type="hidden" name="id" value={post.id} />}
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && <Alert kind="success">Saved.</Alert>}
      <Field label="Title" name="title" defaultValue={post?.title} error={fe.title} />
      <div className="mb-4">
        <label htmlFor="f-caption" className="mb-1 block text-sm text-zinc-300">
          Caption
        </label>
        <textarea
          id="f-caption"
          name="caption"
          rows={4}
          defaultValue={post?.caption ?? ""}
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-zinc-400"
        />
        {fe.caption && <p className="mt-1 text-xs text-red-400">{fe.caption}</p>}
      </div>
      <div className="mb-4 grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="f-tier" className="mb-1 block text-sm text-zinc-300">
            Tier
          </label>
          <select
            id="f-tier"
            name="tier"
            defaultValue={post?.tier ?? "subscriber"}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
          >
            <option value="free">Free preview</option>
            <option value="subscriber">Subscribers</option>
            <option value="ppv">Pay-per-view</option>
          </select>
        </div>
        <Field
          label="PPV price (USD)"
          name="price"
          type="number"
          required={false}
          defaultValue={post?.priceCents != null ? (post.priceCents / 100).toFixed(2) : ""}
          error={fe.price}
          hint="Only for pay-per-view"
        />
      </div>
      <SubmitButton pendingText="Saving…">{submitLabel}</SubmitButton>
    </form>
  );
}
