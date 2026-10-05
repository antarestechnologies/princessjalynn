import { getCurrentUser } from "@/auth/session";
import { Card } from "@/components/ui";
import { ResendButton } from "./resend-button";

export const metadata = { title: "Check your email" };

export default async function VerifyEmailSentPage() {
  const user = await getCurrentUser();
  return (
    <Card title="Check your email">
      <p className="mb-4 text-sm text-zinc-300">
        We sent a confirmation link to your email address. Click it to activate your account. The
        link expires in 24 hours.
      </p>
      {user && !user.emailVerifiedAt ? (
        <ResendButton />
      ) : (
        <p className="text-sm text-zinc-500">
          Didn&apos;t get it? Sign in and you can request another.
        </p>
      )}
    </Card>
  );
}
