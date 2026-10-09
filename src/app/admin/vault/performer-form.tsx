"use client";

import { useActionState } from "react";
import type { PerformerPii } from "@/compliance/vault";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field } from "@/components/ui";
import type { VaultState } from "./actions";

export function PerformerForm({
  action,
  id,
  stageName,
  pii,
  submitLabel,
}: {
  action: (prev: VaultState, form: FormData) => Promise<VaultState>;
  id?: string;
  stageName?: string;
  pii?: PerformerPii;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<VaultState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={formAction} noValidate className="max-w-xl" autoComplete="off">
      {id && <input type="hidden" name="id" value={id} />}
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && <Alert kind="success">Saved.</Alert>}
      <Field
        label="Stage name (shown in admin lists)"
        name="stageName"
        defaultValue={stageName}
        error={fe.stageName}
      />
      <Field
        label="Legal name"
        name="legalName"
        defaultValue={pii?.legalName}
        error={fe.legalName}
      />
      <Field
        label="Other names used (comma separated)"
        name="aliases"
        required={false}
        defaultValue={pii?.aliases.join(", ")}
        error={fe.aliases}
      />
      <Field
        label="Date of birth"
        name="dateOfBirth"
        type="date"
        defaultValue={pii?.dateOfBirth}
        error={fe.dateOfBirth}
      />
      <div className="mb-4">
        <label htmlFor="f-idType" className="mb-1 block text-sm text-zinc-300">
          ID type
        </label>
        <select
          id="f-idType"
          name="idType"
          defaultValue={pii?.idType ?? "drivers_license"}
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
        >
          <option value="passport">Passport</option>
          <option value="drivers_license">Driver&apos;s licence</option>
          <option value="state_id">State ID</option>
          <option value="national_id">National ID</option>
          <option value="other">Other</option>
        </select>
      </div>
      <Field label="ID number" name="idNumber" defaultValue={pii?.idNumber} error={fe.idNumber} />
      <Field
        label="Issuing authority"
        name="idIssuer"
        defaultValue={pii?.idIssuer}
        error={fe.idIssuer}
        hint="e.g. State of Alabama"
      />
      <Field
        label="ID expiration"
        name="idExpiration"
        type="date"
        required={false}
        defaultValue={pii?.idExpiration}
        error={fe.idExpiration}
      />
      <div className="mb-4">
        <label htmlFor="f-notes" className="mb-1 block text-sm text-zinc-300">
          Notes
        </label>
        <textarea
          id="f-notes"
          name="notes"
          rows={3}
          defaultValue={pii?.notes ?? ""}
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
        />
      </div>
      <SubmitButton pendingText="Saving…">{submitLabel}</SubmitButton>
    </form>
  );
}
