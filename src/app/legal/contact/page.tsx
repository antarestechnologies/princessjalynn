import Link from "next/link";
import { LegalPlaceholder } from "@/components/legal-placeholder";

export const metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <>
      <LegalPlaceholder
        title="Contact"
        purpose="Processors require a working customer-support contact on the site."
        needs={[
          "Support email address (monitored)",
          "Support phone number, if the processor requires one",
          "Business name and mailing address",
          "Expected response time",
        ]}
      />
      <p className="mt-6 text-sm">
        To report content that should not be here, use the{" "}
        <Link href="/legal/takedown" className="underline">
          content report form
        </Link>
        .
      </p>
    </>
  );
}
