import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/session";
import { BotFields } from "@/components/bot-fields";
import { Card } from "@/components/ui";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Create an account" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/account");
  return (
    <Card title="Create an account">
      <p className="mb-4 text-sm text-zinc-400">
        You must be 18 or older. We will ask you to confirm your email and then verify your age with
        an independent provider before you can view content.
      </p>
      <SignupForm botFields={<BotFields />} />
    </Card>
  );
}
