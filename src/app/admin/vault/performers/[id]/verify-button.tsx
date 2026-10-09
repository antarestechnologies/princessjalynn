"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui";
import { verifyPerformerAction, type VaultState } from "../../actions";

export function VerifyButton({ id }: { id: string }) {
  const [state, action] = useActionState<VaultState, FormData>(verifyPerformerAction, {});
  return (
    <form action={action} className="max-w-sm">
      <input type="hidden" name="id" value={id} />
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && <Alert kind="success">Verified.</Alert>}
      <SubmitButton pendingText="Checking…">Mark verified</SubmitButton>
    </form>
  );
}
