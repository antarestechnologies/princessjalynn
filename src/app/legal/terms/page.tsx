import { LegalPlaceholder } from "@/components/legal-placeholder";

export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPlaceholder
      title="Terms of Service"
      purpose="The agreement between the site operator and members. Processors require it to be live before approval."
      needs={[
        "Operator legal entity name and jurisdiction",
        "Eligibility: minimum age, age-verification requirement, prohibited jurisdictions if any",
        "Membership, pay-per-view and tip terms; auto-renewal disclosure; pricing changes",
        "Licence to view: personal, non-transferable; prohibition on recording, downloading, redistribution",
        "Consequences of leaking content, including traceable watermarking and account termination",
        "Account suspension and termination; chargeback consequences",
        "Disclaimers, limitation of liability, governing law, dispute resolution",
        "Changes to terms and how members are notified",
      ]}
    />
  );
}
