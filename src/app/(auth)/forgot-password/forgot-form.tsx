"use client";

import { useActionState } from "react";
import { forgotPasswordAction, type ActionState } from "@/auth/actions";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field } from "@/components/ui";

export function ForgotForm({ botFields }: { botFields: React.ReactNode }) {
  const [state, action] = useActionState<ActionState, FormData>(forgotPasswordAction, {});
  if (state.ok) {
    return (
      <Alert kind="success">
        If an account exists for that email, a reset link is on its way. It expires in one hour.
      </Alert>
    );
  }
  return (
    <form action={action} noValidate>
      {botFields}
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        error={state.fieldErrors?.email}
      />
      <SubmitButton pendingText="Sending…">Send reset link</SubmitButton>
    </form>
  );
}
