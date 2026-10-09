import Link from "next/link";

export const LEGAL_LINKS = [
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/refunds", label: "Refunds & cancellation" },
  { href: "/legal/dmca", label: "DMCA" },
  { href: "/legal/2257", label: "18 U.S.C. 2257" },
  { href: "/legal/takedown", label: "Report content" },
  { href: "/legal/contact", label: "Contact" },
];

/** Reachable before the age gate (see age-gate.ts). Must never contain adult content. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 p-6">
      <nav className="mb-6 flex flex-wrap gap-x-4 gap-y-1 border-b border-zinc-800 pb-3 text-sm text-zinc-400">
        {LEGAL_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="hover:text-zinc-100">
            {l.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
