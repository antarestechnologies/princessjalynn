import Link from "next/link";
import { requireAdmin } from "@/auth/session";
import { fakePaymentsAllowed } from "@/payments";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="mx-auto w-full max-w-5xl flex-1 p-6">
      <nav className="mb-6 flex gap-4 border-b border-zinc-800 pb-3 text-sm text-zinc-300">
        <span className="font-semibold text-zinc-100">Admin</span>
        <Link href="/admin/posts">Posts</Link>
        <Link href="/admin/revenue">Revenue</Link>
        {fakePaymentsAllowed() && <Link href="/admin/fake-payments">Fake payments</Link>}
        <Link href="/feed">View site</Link>
      </nav>
      {children}
    </div>
  );
}
