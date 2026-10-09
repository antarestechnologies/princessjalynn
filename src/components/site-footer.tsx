import Link from "next/link";

const LINKS = [
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/refunds", label: "Refunds" },
  { href: "/legal/dmca", label: "DMCA" },
  { href: "/legal/2257", label: "2257" },
  { href: "/legal/takedown", label: "Report content" },
  { href: "/legal/contact", label: "Contact" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-800 px-6 py-4 text-xs text-zinc-500">
      <nav className="flex flex-wrap gap-x-4 gap-y-1">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="hover:text-zinc-300">
            {l.label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
