import Link from "next/link";
import { eq } from "drizzle-orm";
import { requireUser } from "@/auth/session";
import { getDb } from "@/db/client";
import { checkoutSessions } from "@/db/schema";
import { Alert, Card } from "@/components/ui";

export const metadata = { title: "Payment" };

/**
 * Where the processor sends the fan back. The webhook, not this page, grants access; this
 * only reports the checkout's current state and links onward.
 */
export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; canceled?: string }>;
}) {
  const user = await requireUser("/feed");
  const { c, canceled } = await searchParams;
  const checkout =
    c && /^[0-9a-f-]{36}$/.test(c)
      ? await getDb().query.checkoutSessions.findFirst({ where: eq(checkoutSessions.id, c) })
      : null;
  const mine = checkout && checkout.userId === user.id ? checkout : null;
  const dest =
    mine?.kind === "ppv" && mine.postId
      ? `/p/${mine.postId}`
      : mine?.kind === "tip" && mine.postId
        ? `/p/${mine.postId}`
        : "/feed";

  return (
    <Card title={canceled ? "Payment cancelled" : "Thank you"}>
      {canceled && <Alert kind="info">No charge was made.</Alert>}
      {!canceled && mine?.status === "completed" && (
        <Alert kind="success">Payment received. A receipt is on its way to your email.</Alert>
      )}
      {!canceled && mine && mine.status !== "completed" && (
        <Alert kind="info">
          We are waiting for the payment provider to confirm. This usually takes a few seconds;
          refresh this page or check your account.
        </Alert>
      )}
      {!mine && !canceled && (
        <Alert kind="info">
          We could not find that checkout. Check your account for its status.
        </Alert>
      )}
      <p className="text-sm">
        <Link href={dest} className="underline">
          Continue
        </Link>{" "}
        ·{" "}
        <Link href="/account/billing" className="underline">
          Billing
        </Link>
      </p>
    </Card>
  );
}
