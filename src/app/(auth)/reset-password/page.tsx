import Link from "next/link";
import { BotFields } from "@/components/bot-fields";
import { Alert, Card } from "@/components/ui";
import { ResetForm } from "./reset-form";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <Card title="Choose a new password">
        <Alert kind="error">This link is missing its token.</Alert>
        <Link href="/forgot-password" className="text-sm underline">
          Request a new link
        </Link>
      </Card>
    );
  }
  return (
    <Card title="Choose a new password">
      <ResetForm token={token} botFields={<BotFields />} />
    </Card>
  );
}
