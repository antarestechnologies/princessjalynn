import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/session";
import { safeNextPath } from "@/lib/age-gate";
import { BotFields } from "@/components/bot-fields";
import { Card } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; verified?: string; reset?: string }>;
}) {
  const sp = await searchParams;
  if (await getCurrentUser()) redirect(safeNextPath(sp.next));
  const notice = sp.verified
    ? "Email confirmed. You can sign in now."
    : sp.reset
      ? "Password updated. Sign in with your new password."
      : undefined;
  return (
    <Card title="Sign in">
      <LoginForm next={safeNextPath(sp.next)} notice={notice} botFields={<BotFields />} />
    </Card>
  );
}
