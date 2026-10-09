"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field } from "@/components/ui";
import { submitTakedownAction, type TakedownState } from "./actions";

export function TakedownForm({ botFields }: { botFields: React.ReactNode }) {
  const [state, action] = useActionState<TakedownState, FormData>(submitTakedownAction, {});
  if (state.ok) {
    return (
      <Alert kind="success">
        Report received
        {state.reference && state.reference !== "received" ? ` (reference ${state.reference})` : ""}
        . It will be reviewed promptly. If we need more information we will contact you at the email
        you gave.
      </Alert>
    );
  }
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} noValidate className="max-w-xl">
      {botFields}
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <Field label="Your name" name="reporterName" autoComplete="name" error={fe.reporterName} />
      <Field
        label="Your email"
        name="reporterEmail"
        type="email"
        autoComplete="email"
        error={fe.reporterEmail}
      />
      <div className="mb-4">
        <label htmlFor="f-rel" className="mb-1 block text-sm text-zinc-300">
          You are
        </label>
        <select
          id="f-rel"
          name="reporterRelationship"
          defaultValue="copyright_owner"
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
        >
          <option value="copyright_owner">The copyright owner</option>
          <option value="depicted_person">A person shown in the content</option>
          <option value="authorized_agent">Acting on behalf of the owner or person shown</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div className="mb-4">
        <label htmlFor="f-urls" className="mb-1 block text-sm text-zinc-300">
          Links to the content (one per line)
        </label>
        <textarea
          id="f-urls"
          name="contentUrls"
          rows={3}
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
        />
        {fe.contentUrls && <p className="mt-1 text-xs text-red-400">{fe.contentUrls}</p>}
      </div>
      <div className="mb-4">
        <label htmlFor="f-desc" className="mb-1 block text-sm text-zinc-300">
          What is wrong
        </label>
        <textarea
          id="f-desc"
          name="description"
          rows={6}
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
        />
        {fe.description && <p className="mt-1 text-xs text-red-400">{fe.description}</p>}
      </div>
      <label className="mb-4 flex items-start gap-2 text-sm text-zinc-300">
        <input type="checkbox" name="goodFaithAttested" className="mt-1" />
        <span>
          I believe in good faith that the information in this report is accurate. [ATTORNEY COPY
          NEEDED: exact sworn-statement wording for DMCA notices]
        </span>
      </label>
      {fe.goodFaithAttested && (
        <p className="-mt-3 mb-4 text-xs text-red-400">{fe.goodFaithAttested}</p>
      )}
      <SubmitButton pendingText="Sending…">Submit report</SubmitButton>
    </form>
  );
}
