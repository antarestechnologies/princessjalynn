import type { Metadata } from "next";
import { safeNextPath } from "@/lib/age-gate";
import { Button } from "@/components/ui";
import { enterGateAction } from "./actions";

export const metadata: Metadata = {
  title: "Age confirmation",
  robots: { index: false, follow: false },
};

/**
 * The only page a visitor without the attestation cookie can reach. Contains no site
 * content, no imagery, and no account functionality.
 */
export default async function GatePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = safeNextPath(next);
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center shadow-lg">
        <h1 className="text-xl font-semibold tracking-tight">Adults only</h1>
        <p className="mt-3 text-sm text-zinc-300">
          This website contains age-restricted material. By entering you confirm that you are at
          least 18 years old (or the age of majority where you live) and that you wish to view such
          material.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          See the{" "}
          <a href="/legal/terms" className="underline">
            terms
          </a>
          ,{" "}
          <a href="/legal/privacy" className="underline">
            privacy policy
          </a>{" "}
          and{" "}
          <a href="/legal/2257" className="underline">
            2257 statement
          </a>
          . Members are also asked to complete age verification with an independent provider before
          viewing content.
        </p>
        <form action={enterGateAction} className="mt-5 space-y-3">
          <input type="hidden" name="confirm" value="yes" />
          <input type="hidden" name="next" value={safeNext} />
          <Button>I am 18 or older — enter</Button>
        </form>
        <a
          href="https://www.google.com"
          className="mt-3 inline-block w-full rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
        >
          I am under 18 — leave
        </a>
      </div>
    </main>
  );
}
