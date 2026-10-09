import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Members",
  description: "Members-only site.",
  // Belt and braces with the X-Robots-Tag header set in proxy.ts.
  robots: { index: false, follow: false, nocache: true, noimageindex: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
