import { LegalPlaceholder } from "@/components/legal-placeholder";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPlaceholder
      title="Privacy Policy"
      purpose="How member data is collected, used, shared and retained. Must match what the system actually does (summary below for counsel)."
      needs={[
        "Data collected: email, handle, hashed password, IP prefix (truncated), session and audit records, viewing grants used for leak tracing",
        "Age verification: handled by a third-party provider; this site stores only pass/fail and the provider's reference",
        "Payments: handled by the payment processor; this site stores processor ids and amounts, never card numbers",
        "Processors and sub-processors: hosting, database, video, email, age verification, payment provider",
        "Retention periods for accounts, billing records, audit logs and viewing grants",
        "Member rights (access, export, deletion) and how to exercise them; state and international law coverage",
        "Cookies: age-gate cookie, session cookie, vault re-authentication cookie (admin only); no advertising trackers",
        "Contact for privacy requests",
      ]}
    />
  );
}
