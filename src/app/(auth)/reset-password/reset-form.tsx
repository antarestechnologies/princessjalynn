"use client";

import { useActionState } from "react";
import { resetPasswordAction, type ActionState } from "@/auth/actions";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field } from "@/components/ui";

export function ResetForm({ token, botFields }: { token: string; botFields: React.ReactNode }) {
  const [state, action] = useActionState<ActionState, FormData>(resetPasswordAction, {});
  return (
    <form action={action} noValidate>
      {botFields}
      <input type="hidden" name="token" value={token} />
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        error={state.fieldErrors?.password}
        hint="At least 10 characters. All other sessions will be signed out."
      />
      <SubmitButton pendingText="Updating…">Set new password</SubmitButton>
    </form>
  );
}
