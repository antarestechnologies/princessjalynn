/**
 * PLAN.md non-negotiable #7: no invented legal text. Each legal page lists what the attorney
 * must supply, clearly marked, until final copy replaces it.
 */
export function LegalPlaceholder({
  title,
  purpose,
  needs,
}: {
  title: string;
  purpose: string;
  needs: string[];
}) {
  return (
    <article>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 rounded-md border border-amber-800 bg-amber-950 px-3 py-2 text-sm font-semibold text-amber-200">
        [ATTORNEY COPY NEEDED]
      </p>
      <p className="mt-4 text-sm text-zinc-300">{purpose}</p>
      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        To be supplied by counsel
      </h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-300">
        {needs.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </article>
  );
}
