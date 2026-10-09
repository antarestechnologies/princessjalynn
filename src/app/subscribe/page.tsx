import Link from "next/link";
import { redirect } from "next/navigation";
import { requireVerifiedUser } from "@/auth/session";
import { getDb } from "@/db/client";
import { getEnv } from "@/env";
import { findActiveSubscription } from "@/payments/service";
import { SubscribeButton } from "@/components/pay-buttons";
import { Card } from "@/components/ui";
import { formatPrice } from "@/components/post-card";

export const metadata = { title: "Membership" };

export default async function SubscribePage() {
  const user = await requireVerifiedUser("/subscribe");
  if (await findActiveSubscription(getDb(), user.id)) redirect("/account/billing");
  const env = getEnv();
  const price = formatPrice(env.SUBSCRIPTION_PRICE_CENTS);
  return (
    <Card title="Membership">
      <ul className="mb-4 space-y-1 text-sm text-zinc-300">
        <li>{price} per month, billed monthly.</li>
        <li>Access to every subscriber post for as long as you are a member.</li>
        <li>Cancel any time from your account; access runs to the end of the paid month.</li>
        <li>
          The charge appears on your statement as{" "}
          <span className="font-mono">{env.BILLING_DESCRIPTOR}</span>.
        </li>
      </ul>
      <p className="mb-5 text-xs text-zinc-500">
        Payment is handled by our payment provider on their secure page. We never see your card
        number. Refunds and disputes: see our refund policy [ATTORNEY COPY NEEDED].
      </p>
      <SubscribeButton label={`Join for ${price}/month`} />
      <p className="mt-4 text-center text-sm text-zinc-400">
        <Link href="/feed" className="underline">
          Back to feed
        </Link>
      </p>
    </Card>
  );
}
