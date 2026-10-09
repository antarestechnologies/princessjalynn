"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field } from "@/components/ui";
import { deleteAccountAction, type DeleteState } from "./actions";

export function DeleteForm() {
  const [state, action] = useActionState<DeleteState, FormData>(deleteAccountAction, {});
  return (
    <form action={action} className="space-y-1">
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <Field
        label="Your password"
        name="password"
        type="password"
        autoComplete="current-password"
      />
      <Field label='Type "DELETE" to confirm' name="confirm" autoComplete="off" />
      <SubmitButton pendingText="Deleting…">Delete my account</SubmitButton>
    </form>
  );
}
