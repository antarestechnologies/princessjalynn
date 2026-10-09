import { notFound } from "next/navigation";
import { getPerformer } from "@/compliance/vault";
import { getVaultKeyring, requireVaultAccess } from "@/compliance/vault-session";
import { getDb } from "@/db/client";
import { updatePerformerAction } from "../../actions";
import { PerformerForm } from "../../performer-form";
import { VerifyButton } from "./verify-button";

export const metadata = { title: "Admin · Performer record" };

const ERRORS: Record<string, string> = {
  bad_type: "Only JPEG, PNG or PDF files are accepted.",
  too_large: "Files must be 4 MB or smaller.",
  empty: "That file was empty.",
  not_found: "Record not found.",
};

export default async function PerformerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ uploaded?: string; error?: string }>;
}) {
  const { id } = await params;
  const { uploaded, error } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const actor = await requireVaultAccess(`/admin/vault/performers/${id}`);
  const p = await getPerformer(getDb(), getVaultKeyring(), actor, id);
  if (!p) notFound();

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{p.stageName}</h1>
        <span className={p.status === "verified" ? "text-emerald-300" : "text-amber-300"}>
          {p.status}
          {p.verifiedAt ? ` · ${p.verifiedAt.toISOString().slice(0, 10)}` : ""}
        </span>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Identity (encrypted at rest)
        </h2>
        <PerformerForm
          action={updatePerformerAction}
          id={p.id}
          stageName={p.stageName}
          pii={p.pii}
          submitLabel="Save"
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Documents
        </h2>
        {uploaded && <p className="mb-2 text-sm text-emerald-300">Uploaded.</p>}
        {error && <p className="mb-2 text-sm text-red-400">{ERRORS[error] ?? "Upload failed."}</p>}
        <table className="mb-4 w-full text-sm">
          <tbody>
            {p.documents.map((d) => (
              <tr key={d.id} className="border-t border-zinc-800">
                <td className="py-2">{d.kind}</td>
                <td className="text-zinc-400">{d.contentType}</td>
                <td className="text-zinc-400">{Math.ceil(d.sizeBytes / 1024)} KB</td>
                <td className="font-mono text-[10px] text-zinc-500">{d.sha256.slice(0, 16)}…</td>
                <td className="text-zinc-400">{d.createdAt.toISOString().slice(0, 10)}</td>
                <td>
                  <a href={`/api/admin/vault/documents/${d.id}`} className="underline">
                    Download
                  </a>
                </td>
              </tr>
            ))}
            {p.documents.length === 0 && (
              <tr>
                <td className="py-2 text-zinc-500">No documents.</td>
              </tr>
            )}
          </tbody>
        </table>
        <form
          action="/api/admin/vault/documents"
          method="post"
          encType="multipart/form-data"
          className="flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="performerId" value={p.id} />
          <label className="text-sm text-zinc-300">
            Kind
            <select
              name="kind"
              defaultValue="id_front"
              className="mt-1 block rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            >
              <option value="id_front">ID (front)</option>
              <option value="id_back">ID (back)</option>
              <option value="selfie_with_id">Photo holding ID</option>
              <option value="model_release">Model release</option>
              <option value="consent">Consent form</option>
              <option value="other">Other</option>
            </select>
          </label>
          <input
            type="file"
            name="file"
            accept="image/jpeg,image/png,application/pdf"
            required
            className="text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900"
          >
            Upload (encrypted)
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Verification
        </h2>
        {p.status === "verified" ? (
          <p className="text-sm text-zinc-300">This record can be linked to media.</p>
        ) : (
          <>
            <p className="mb-3 max-w-xl text-sm text-zinc-400">
              Requires an uploaded ID (front) and a date of birth at least 18 years ago. Only
              verified records can be linked to media, and media cannot be published without a link.
            </p>
            <VerifyButton id={p.id} />
          </>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Linked media (2257 index)
        </h2>
        <table className="w-full text-sm">
          <tbody>
            {p.links.map((l) => (
              <tr key={l.id} className="border-t border-zinc-800">
                <td className="py-2">{l.postTitleSnapshot}</td>
                <td className="font-mono text-xs text-zinc-400">{l.mediaRef.slice(0, 8)}</td>
                <td>produced {l.productionDate}</td>
                <td className="text-zinc-400">{l.mediaId ? "on site" : "removed from site"}</td>
              </tr>
            ))}
            {p.links.length === 0 && (
              <tr>
                <td className="py-2 text-zinc-500">Not linked to any media yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
