import { redirect } from "next/navigation";
import { requireUser } from "@/auth/session";
import { Card } from "@/components/ui";
import { StartButton } from "./start-button";

export const metadata = { title: "Verify your age" };

export default async function VerifyAgePage() {
  const user = await requireUser("/verify-age");
  if (!user.emailVerifiedAt) redirect("/verify-email/sent");
  if (user.ageVerifiedAt) redirect("/account");
  return (
    <Card title="Verify your age">
      <p className="mb-3 text-sm text-zinc-300">
        The law where many of our members live requires us to confirm that you are an adult using an
        independent verification provider before you can view content.
      </p>
      <p className="mb-5 text-sm text-zinc-400">
        The provider checks your age and tells us only pass or fail. We never receive or store your
        ID document, selfie or date of birth. The result is stored against your account once; you
        will not be asked again.
      </p>
      <StartButton />
    </Card>
  );
}
