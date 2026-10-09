import { getDb } from "@/db/client";
import { revenueStats } from "@/payments/service";
import { formatPrice } from "@/components/post-card";

export const metadata = { title: "Admin · Revenue" };

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-400">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${warn ? "text-amber-300" : ""}`}>{value}</div>
    </div>
  );
}

export default async function RevenuePage() {
  const s = await revenueStats(getDb());
  const rate = (s.last90.chargebackRate * 100).toFixed(2) + "%";
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Revenue</h1>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Active subscribers" value={String(s.activeSubscribers)} />
        <Stat label="MRR" value={formatPrice(s.mrrCents)} />
        <Stat label="Past due" value={String(s.pastDue)} warn={s.pastDue > 0} />
        <Stat label="Chargeback rate (90d)" value={rate} warn={s.last90.chargebackRate >= 0.005} />
      </div>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        This month
      </h2>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Memberships" value={formatPrice(s.month.subscriptionCents)} />
        <Stat label="Unlocks" value={formatPrice(s.month.ppvCents)} />
        <Stat label="Tips" value={formatPrice(s.month.tipCents)} />
        <Stat label="Refunded" value={formatPrice(s.month.refundedCents)} />
        <Stat
          label="Chargebacks"
          value={String(s.month.chargebacks)}
          warn={s.month.chargebacks > 0}
        />
      </div>
      <p className="mb-6 text-xs text-zinc-500">
        Processors watch the chargeback ratio: Visa/Mastercard programmes start at roughly 1% and
        most high-risk IPSPs act well before that. Refund quickly and generously; a refund is not a
        chargeback.
      </p>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Recent payments (90 days)
      </h2>
      <table className="w-full text-sm">
        <thead className="text-left text-zinc-400">
          <tr>
            <th className="py-1">When</th>
            <th>Fan</th>
            <th>Kind</th>
            <th className="text-right">Amount</th>
            <th className="text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {s.recent.map((r, i) => (
            <tr key={i} className="border-t border-zinc-800">
              <td className="py-1 text-zinc-400">
                {r.at.toISOString().slice(0, 16).replace("T", " ")}
              </td>
              <td>@{r.handle}</td>
              <td>{r.kind}</td>
              <td className="text-right">{formatPrice(r.amountCents)}</td>
              <td
                className={`text-right ${r.status !== "paid" ? "text-amber-300" : "text-zinc-400"}`}
              >
                {r.status}
              </td>
            </tr>
          ))}
          {s.recent.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-center text-zinc-500">
                No payments yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
