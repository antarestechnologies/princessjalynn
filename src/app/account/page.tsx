import Link from "next/link";
import { signOutAction } from "@/auth/actions";
import { requireUser } from "@/auth/session";
import { maskEmail } from "@/lib/logger";
import { Button, Card } from "@/components/ui";

export const metadata = { title: "Your account" };

function Row({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-800 py-2 text-sm">
      <span className="text-zinc-400">{label}</span>
      <span className={ok ? "text-emerald-300" : "text-amber-300"}>{value}</span>
    </div>
  );
}

export default async function AccountPage() {
  const user = await requireUser("/account");
  return (
    <Card title="Your account">
      <Row label="Handle" value={`@${user.handle}`} ok />
      <Row label="Email" value={maskEmail(user.email)} ok />
      <Row
        label="Email confirmed"
        value={user.emailVerifiedAt ? "Yes" : "Not yet"}
        ok={!!user.emailVerifiedAt}
      />
      <Row
        label="Age verified"
        value={user.ageVerifiedAt ? "Yes" : "Not yet"}
        ok={!!user.ageVerifiedAt}
      />

      <div className="mt-5 space-y-3">
        {!user.emailVerifiedAt && (
          <Link href="/verify-email/sent" className="block text-sm underline">
            Confirm your email
          </Link>
        )}
        {user.emailVerifiedAt && !user.ageVerifiedAt && (
          <Link href="/verify-age" className="block text-sm underline">
            Verify your age to unlock content
          </Link>
        )}
        <Link href="/account/billing" className="block text-sm underline">
          Membership and billing
        </Link>
        <Link href="/account/privacy" className="block text-sm underline">
          Privacy, data download and account deletion
        </Link>
        <form action={signOutAction}>
          <Button variant="secondary">Sign out</Button>
        </form>
      </div>
    </Card>
  );
}
