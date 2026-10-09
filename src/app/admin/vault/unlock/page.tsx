import { safeNextPath } from "@/lib/age-gate";
import { UnlockForm } from "./unlock-form";

export const metadata = { title: "Admin · Unlock 2257 vault" };

export default async function UnlockVaultPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">Unlock the 2257 vault</h1>
      <p className="mb-4 max-w-xl text-sm text-zinc-400">
        The vault holds identity documents. Re-enter your password to open it for 10 minutes. Every
        unlock, view, download and export is written to the audit log.
      </p>
      <UnlockForm next={safeNextPath(next ?? "/admin/vault")} />
    </div>
  );
}
