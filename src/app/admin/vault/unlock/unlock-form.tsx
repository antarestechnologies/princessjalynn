"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field } from "@/components/ui";
import { unlockVaultAction, type VaultState } from "../actions";

export function UnlockForm({ next }: { next: string }) {
  const [state, action] = useActionState<VaultState, FormData>(unlockVaultAction, {});
  return (
    <form action={action} className="max-w-sm">
      <input type="hidden" name="next" value={next} />
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <Field
        label="Your password"
        name="password"
        type="password"
        autoComplete="current-password"
      />
      <SubmitButton pendingText="Checking…">Unlock for 10 minutes</SubmitButton>
    </form>
  );
}
