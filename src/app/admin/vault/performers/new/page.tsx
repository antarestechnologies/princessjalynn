import { requireVaultAccess } from "@/compliance/vault-session";
import { createPerformerAction } from "../../actions";
import { PerformerForm } from "../../performer-form";

export const metadata = { title: "Admin · New performer record" };

export default async function NewPerformerPage() {
  await requireVaultAccess("/admin/vault/performers/new");
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">New performer record</h1>
      <PerformerForm action={createPerformerAction} submitLabel="Create record" />
    </div>
  );
}
