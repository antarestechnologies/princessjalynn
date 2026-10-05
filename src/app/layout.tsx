import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Members",
  description: "Members-only site.",
  // Nothing here is indexable until the age gate (Phase 2) decides otherwise.
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">{children}</body>
    </html>
  );
}
