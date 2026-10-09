import { notFound } from "next/navigation";
import { requireUser } from "@/auth/session";
import { getEnv } from "@/env";
import { Alert, Button, Card } from "@/components/ui";
import { stubCompleteAction } from "./actions";

export const metadata = { title: "Stub age verification" };

/**
 * Stand-in for the vendor's hosted flow. Exists only while AGE_VERIFIER=stub and the stub is
 * allowed; otherwise 404s so nothing hints at it in production.
 */
export default async function StubVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string }>;
}) {
  const env = getEnv();
  if (
    env.AGE_VERIFIER !== "stub" ||
    (env.NODE_ENV === "production" && !env.ALLOW_STUB_AGE_VERIFIER)
  )
    notFound();
  await requireUser("/verify-age");
  const { v } = await searchParams;
  if (!v) notFound();
  return (
    <Card title="Stub verification provider">
      <Alert kind="info">
        Development only. A real provider would check an ID or estimate age from a selfie here. Pick
        an outcome.
      </Alert>
      <div className="space-y-3">
        <form action={stubCompleteAction}>
          <input type="hidden" name="v" value={v} />
          <input type="hidden" name="outcome" value="passed" />
          <Button>Simulate: verified as 18+</Button>
        </form>
        <form action={stubCompleteAction}>
          <input type="hidden" name="v" value={v} />
          <input type="hidden" name="outcome" value="failed" />
          <Button variant="danger">Simulate: verification failed</Button>
        </form>
      </div>
    </Card>
  );
}
