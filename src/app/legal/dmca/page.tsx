import Link from "next/link";
import { LegalPlaceholder } from "@/components/legal-placeholder";

export const metadata = { title: "DMCA" };

export default function DmcaPage() {
  return (
    <>
      <LegalPlaceholder
        title="DMCA and Copyright"
        purpose="Notice-and-takedown procedure and the designated agent registered with the U.S. Copyright Office."
        needs={[
          "Designated DMCA agent: name, address, phone, email, and Copyright Office registration number",
          "Required elements of a valid notice (17 U.S.C. 512(c)(3))",
          "Counter-notice procedure",
          "Repeat infringer policy",
        ]}
      />
      <p className="mt-6 text-sm">
        To report content now, use the{" "}
        <Link href="/legal/takedown" className="underline">
          content report form
        </Link>
        .
      </p>
    </>
  );
}
