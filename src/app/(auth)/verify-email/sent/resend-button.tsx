"use client";

import { useActionState } from "react";
import { resendVerificationAction, type ActionState } from "@/auth/actions";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui";

export function ResendButton() {
  const [state, action] = useActionState<ActionState, FormData>(resendVerificationAction, {});
  return (
    <form action={action}>
      {state.ok && <Alert kind="success">Sent. Check your inbox and spam folder.</Alert>}
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <SubmitButton pendingText="Sending…">Resend confirmation email</SubmitButton>
    </form>
  );
}
