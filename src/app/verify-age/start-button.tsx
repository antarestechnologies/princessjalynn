"use client";

import { useActionState } from "react";
import { beginAgeVerificationAction, type ActionState } from "@/auth/actions";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui";

export function StartButton() {
  const [state, action] = useActionState<ActionState, FormData>(beginAgeVerificationAction, {});
  return (
    <form action={action}>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <SubmitButton pendingText="Starting…">Start age verification</SubmitButton>
    </form>
  );
}
