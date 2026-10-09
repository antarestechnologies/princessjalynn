import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { requireUser } from "@/auth/session";
import { getDb } from "@/db/client";
import { checkoutSessions } from "@/db/schema";
import { getEnv } from "@/env";
import { getFakeProcessor } from "@/payments";
import { formatPrice } from "@/components/post-card";
import { Alert, Button, Card } from "@/components/ui";
import { fakeCheckoutAction } from "./actions";

export const metadata = { title: "Fake payment page" };

/** Stands in for the processor's hosted checkout. 404 unless the fake processor is allowed. */
export default async function FakePayPage({ params }: { params: Promise<{ id: string }> }) {
  if (!getFakeProcessor()) notFound();
  const user = await requireUser("/feed");
  const { id } = await params;
  const checkout = /^[0-9a-f-]{36}$/.test(id)
    ? await getDb().query.checkoutSessions.findFirst({ where: eq(checkoutSessions.id, id) })
    : null;
  if (!checkout || checkout.userId !== user.id) notFound();
  const env = getEnv();
  return (
    <Card title="Fake payment provider">
      <Alert kind="info">
        Development only. A real processor would show its card form here. Card data never touches
        this site.
      </Alert>
      <dl className="mb-5 space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-zinc-400">Item</dt>
          <dd>{checkout.description}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-zinc-400">Amount</dt>
          <dd>{formatPrice(checkout.amountCents, checkout.currency)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-zinc-400">Statement descriptor</dt>
          <dd className="font-mono">{env.BILLING_DESCRIPTOR}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-zinc-400">Status</dt>
          <dd>{checkout.status}</dd>
        </div>
      </dl>
      {checkout.status === "pending" ? (
        <div className="space-y-3">
          <form action={fakeCheckoutAction}>
            <input type="hidden" name="checkoutId" value={checkout.id} />
            <input type="hidden" name="outcome" value="paid" />
            <Button>Simulate: payment approved</Button>
          </form>
          <form action={fakeCheckoutAction}>
            <input type="hidden" name="checkoutId" value={checkout.id} />
            <input type="hidden" name="outcome" value="declined" />
            <Button variant="secondary">Simulate: card declined / cancel</Button>
          </form>
        </div>
      ) : (
        <p className="text-sm text-zinc-400">This checkout is {checkout.status}.</p>
      )}
    </Card>
  );
}
