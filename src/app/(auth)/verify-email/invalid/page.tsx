import Link from "next/link";
import { Alert, Card } from "@/components/ui";

export const metadata = { title: "Link not valid" };

export default async function VerifyEmailInvalidPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message =
    reason === "expired"
      ? "This confirmation link has expired."
      : reason === "used"
        ? "This confirmation link was already used."
        : "This confirmation link is not valid.";
  return (
    <Card title="Link not valid">
      <Alert kind="error">{message}</Alert>
      <p className="text-sm text-zinc-400">
        <Link href="/login" className="underline">
          Sign in
        </Link>{" "}
        and request a new confirmation email from your account page.
      </p>
    </Card>
  );
}
