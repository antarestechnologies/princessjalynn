import { BotFields } from "@/components/bot-fields";
import { Card } from "@/components/ui";
import { ForgotForm } from "./forgot-form";

export const metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <Card title="Reset your password">
      <ForgotForm botFields={<BotFields />} />
    </Card>
  );
}
