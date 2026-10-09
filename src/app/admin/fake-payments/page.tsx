import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { purchases, subscriptions, tips, users } from "@/db/schema";
import { getFakeProcessor } from "@/payments";
import { formatPrice } from "@/components/post-card";
import { Alert } from "@/components/ui";
import { simulateAction } from "./actions";

export const metadata = { title: "Admin · Fake payments" };

function Op({
  op,
  subscriptionId,
  transactionId,
  label,
  danger,
}: {
  op: string;
  subscriptionId?: string;
  transactionId?: string;
  label: string;
  danger?: boolean;
}) {
  return (
    <form action={simulateAction} className="inline">
      <input type="hidden" name="op" value={op} />
      {subscriptionId && <input type="hidden" name="subscriptionId" value={subscriptionId} />}
      {transactionId && <input type="hidden" name="transactionId" value={transactionId} />}
      <button
        type="submit"
        className={`mr-2 rounded border px-2 py-0.5 text-xs ${danger ? "border-red-800 text-red-300" : "border-zinc-700 text-zinc-200"} hover:bg-zinc-800`}
      >
        {label}
      </button>
    </form>
  );
}

export default async function FakePaymentsPage() {
  if (!getFakeProcessor()) notFound();
  const db = getDb();
  const subs = await db
    .select({ s: subscriptions, handle: users.handle })
    .from(subscriptions)
    .innerJoin(users, eq(users.id, subscriptions.userId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(50);
  const ppv = await db
    .select({ p: purchases, handle: users.handle })
    .from(purchases)
    .innerJoin(users, eq(users.id, purchases.userId))
    .orderBy(desc(purchases.createdAt))
    .limit(30);
  const tipRows = await db
    .select({ t: tips, handle: users.handle })
    .from(tips)
    .innerJoin(users, eq(users.id, tips.userId))
    .orderBy(desc(tips.createdAt))
    .limit(30);
  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-2 text-xl font-semibold">Fake processor console</h1>
        <Alert kind="info">
          Development only. Each button delivers a signed webhook through the real ingest path,
          exactly as a processor would. Use it to walk a subscription through renew → fail → cancel
          → expire, and to refund or dispute any payment.
        </Alert>
      </div>
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Subscriptions
        </h2>
        <table className="w-full text-sm">
          <tbody>
            {subs.map(({ s, handle }) => (
              <tr key={s.id} className="border-t border-zinc-800 align-top">
                <td className="py-2">@{handle}</td>
                <td>{s.status}</td>
                <td className="text-zinc-400">
                  until {(s.graceUntil ?? s.currentPeriodEnd).toISOString().slice(0, 10)}
                </td>
                <td>
                  <Op op="renew" subscriptionId={s.id} label="Renew" />
                  <Op op="fail" subscriptionId={s.id} label="Fail renewal" />
                  <Op op="cancel" subscriptionId={s.id} label="Cancel" />
                  <Op op="expire" subscriptionId={s.id} label="Expire" />
                  <Op op="refund_last" subscriptionId={s.id} label="Refund last" danger />
                  <Op op="chargeback_last" subscriptionId={s.id} label="Chargeback last" danger />
                </td>
              </tr>
            ))}
            {subs.length === 0 && (
              <tr>
                <td className="py-3 text-zinc-500">
                  No subscriptions. Subscribe as a fan at /subscribe first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Unlocks and tips
        </h2>
        <table className="w-full text-sm">
          <tbody>
            {[
              ...ppv.map((r) => ({
                id: r.p.id,
                handle: r.handle,
                kind: "Unlock",
                amount: r.p.amountCents,
                status: r.p.status,
                txn: r.p.processorTransactionId,
              })),
              ...tipRows.map((r) => ({
                id: r.t.id,
                handle: r.handle,
                kind: "Tip",
                amount: r.t.amountCents,
                status: r.t.status,
                txn: r.t.processorTransactionId,
              })),
            ].map((r) => (
              <tr key={r.id} className="border-t border-zinc-800">
                <td className="py-2">@{r.handle}</td>
                <td>{r.kind}</td>
                <td>{formatPrice(r.amount)}</td>
                <td>{r.status}</td>
                <td>
                  <Op op="refund" transactionId={r.txn} label="Refund" danger />
                  <Op op="chargeback" transactionId={r.txn} label="Chargeback" danger />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
