"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUpAction, type ActionState } from "@/auth/actions";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field } from "@/components/ui";

export function SignupForm({ botFields }: { botFields: React.ReactNode }) {
  const [state, action] = useActionState<ActionState, FormData>(signUpAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} noValidate>
      {botFields}
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <Field label="Email" name="email" type="email" autoComplete="email" error={fe.email} />
      <Field
        label="Handle"
        name="handle"
        autoComplete="username"
        error={fe.handle}
        hint="3–20 letters, numbers or underscores. Shown on your account and on any video you watch."
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        error={fe.password}
        hint="At least 10 characters."
      />
      <SubmitButton pendingText="Creating account…">Create account</SubmitButton>
      <p className="mt-4 text-center text-sm text-zinc-400">
        Already a member?{" "}
        <Link href="/login" className="underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
