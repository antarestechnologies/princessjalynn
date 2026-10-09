import Link from "next/link";
import { requireUser } from "@/auth/session";
import { getDb } from "@/db/client";
import { getEnv } from "@/env";
import { billingHistory, latestSubscription } from "@/payments/service";
import { CancelSubscriptionButton } from "@/components/pay-buttons";
import { formatPrice } from "@/components/post-card";
import { Alert, Card } from "@/components/ui";

export const metadata = { title: "Billing" };

const STATUS_TEXT: Record<string, string> = {
  active: "Active",
  past_due: "Payment failed, in grace period",
  canceled: "Cancelled",
  expired: "Expired",
  chargeback: "Paused (payment disputed)",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string }>;
}) {
  const user = await requireUser("/account/billing");
  const { canceled } = await searchParams;
  const db = getDb();
  const [sub, history] = await Promise.all([
    latestSubscription(db, user.id),
    billingHistory(db, user.id),
  ]);
  const env = getEnv();
  const now = new Date().getTime();
  const accessUntil = sub ? (sub.graceUntil ?? sub.currentPeriodEnd) : null;
  const live =
    !!sub &&
    (sub.status === "active" ||
      sub.status === "past_due" ||
      (sub.status === "canceled" && sub.currentPeriodEnd.getTime() > now));

  return (
    <Card title="Billing">
      {canceled && (
        <Alert kind="success">
          Your membership will not renew. Access continues until the end of the paid period.
        </Alert>
      )}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Membership
        </h2>
        {sub ? (
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-400">Status</dt>
              <dd>{STATUS_TEXT[sub.status] ?? sub.status}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-400">
                {sub.status === "active" ? "Renews" : "Access until"}
              </dt>
              <dd>{accessUntil ? accessUntil.toISOString().slice(0, 10) : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-400">Price</dt>
              <dd>{formatPrice(sub.priceCents, sub.currency)}/month</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-zinc-400">No membership yet.</p>
        )}
        <div className="mt-4">
          {live && sub?.status !== "canceled" ? (
            <CancelSubscriptionButton />
          ) : (
            <Link
              href="/subscribe"
              className="block rounded-md bg-zinc-100 px-4 py-2 text-center text-sm font-medium text-zinc-900"
            >
              {sub ? "Rejoin" : "Join"}
            </Link>
          )}
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Cancel any time; no questions asked. Charges appear as{" "}
          <span className="font-mono">{env.BILLING_DESCRIPTOR}</span>. Refund policy: [ATTORNEY COPY
          NEEDED].
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Payments
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-zinc-400">No payments yet.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {history.map((h) => (
                <tr key={h.txn} className="border-t border-zinc-800">
                  <td className="py-1 text-zinc-400">{h.at.toISOString().slice(0, 10)}</td>
                  <td>{h.kind}</td>
                  <td className="text-right">{formatPrice(h.amountCents, h.currency)}</td>
                  <td className="text-right text-zinc-400">{h.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </Card>
  );
}
