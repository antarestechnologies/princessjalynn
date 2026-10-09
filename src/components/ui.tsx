import type { ReactNode } from "react";

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-lg">
        <h1 className="mb-4 text-xl font-semibold tracking-tight">{title}</h1>
        {children}
      </div>
    </main>
  );
}

export function Field({
  label,
  name,
  type = "text",
  autoComplete,
  error,
  hint,
  required = true,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  const id = `f-${name}`;
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1 block text-sm text-zinc-300">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-zinc-400"
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-zinc-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="mt-1 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export function Alert({
  kind,
  children,
}: {
  kind: "error" | "success" | "info";
  children: ReactNode;
}) {
  const color =
    kind === "error"
      ? "border-red-900 bg-red-950 text-red-200"
      : kind === "success"
        ? "border-emerald-900 bg-emerald-950 text-emerald-200"
        : "border-zinc-700 bg-zinc-800 text-zinc-200";
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={`mb-4 rounded-md border px-3 py-2 text-sm ${color}`}
    >
      {children}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  disabled,
  type = "submit",
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  type?: "submit" | "button";
}) {
  const styles =
    variant === "primary"
      ? "bg-zinc-100 text-zinc-900 hover:bg-white"
      : variant === "danger"
        ? "bg-red-700 text-white hover:bg-red-600"
        : "border border-zinc-700 text-zinc-100 hover:bg-zinc-800";
  return (
    <button
      type={type}
      disabled={disabled}
      className={`w-full rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${styles}`}
    >
      {children}
    </button>
  );
}
