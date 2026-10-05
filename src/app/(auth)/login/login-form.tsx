"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction, type ActionState } from "@/auth/actions";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field } from "@/components/ui";

export function LoginForm({
  next,
  notice,
  botFields,
}: {
  next: string;
  notice?: string;
  botFields: React.ReactNode;
}) {
  const [state, action] = useActionState<ActionState, FormData>(signInAction, {});
  return (
    <form action={action} noValidate>
      {botFields}
      <input type="hidden" name="next" value={next} />
      {notice && <Alert kind="success">{notice}</Alert>}
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <Field label="Email" name="email" type="email" autoComplete="email" />
      <Field label="Password" name="password" type="password" autoComplete="current-password" />
      <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
      <p className="mt-4 text-center text-sm text-zinc-400">
        <Link href="/forgot-password" className="underline">
          Forgot your password?
        </Link>{" "}
        ·{" "}
        <Link href="/signup" className="underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
