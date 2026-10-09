import Link from "next/link";
import { requireUser } from "@/auth/session";
import { Card } from "@/components/ui";
import { DeleteForm } from "./delete-form";

export const metadata = { title: "Privacy and your data" };

export default async function PrivacyPage() {
  const user = await requireUser("/account/privacy");
  return (
    <Card title="Privacy and your data">
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Download your data
        </h2>
        <p className="mb-3 text-sm text-zinc-300">
          A file with everything we store about your account: profile, sign-ins, payments, purchases
          and viewing history.
        </p>
        <a
          href="/api/account/export"
          className="block rounded-md border border-zinc-700 px-4 py-2 text-center text-sm"
        >
          Download (JSON)
        </a>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Delete your account
        </h2>
        {user.role === "admin" ? (
          <p className="text-sm text-zinc-400">Admin accounts cannot be deleted here.</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-zinc-300">
              This cancels any membership, ends access immediately, signs you out everywhere and
              removes your email and handle. Payment records are kept as the law requires but are no
              longer linked to your email. This cannot be undone.{" "}
              <Link href="/legal/privacy" className="underline">
                Privacy policy
              </Link>
            </p>
            <DeleteForm />
          </>
        )}
      </section>
    </Card>
  );
}
