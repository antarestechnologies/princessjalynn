import { LegalPlaceholder } from "@/components/legal-placeholder";

export const metadata = { title: "Refunds and Cancellation" };

export default function RefundsPage() {
  return (
    <LegalPlaceholder
      title="Refunds and Cancellation"
      purpose="Processors and card networks require a clear, visible refund and cancellation policy before approval."
      needs={[
        "How to cancel: from Account → Billing at any time; cancellation stops renewal and access continues to the end of the paid period (current system behaviour)",
        "Refund eligibility for memberships, pay-per-view unlocks and tips",
        "How to request a refund and expected response time",
        "Statement descriptor members will see on their card statement",
        "What happens to access after a refund (current system behaviour: access for the refunded item ends)",
        "Chargebacks: effect on the account (current system behaviour: all access paused pending review)",
      ]}
    />
  );
}
