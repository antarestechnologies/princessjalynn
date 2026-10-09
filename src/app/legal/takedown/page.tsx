import { BotFields } from "@/components/bot-fields";
import { TakedownForm } from "./takedown-form";

export const metadata = { title: "Report content" };

/** Public: someone shown in content may not want to pass the 18+ gate to report it. */
export default function TakedownPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Report content</h1>
      <p className="mt-3 text-sm text-zinc-300">
        Use this form to report content that infringes your copyright, shows you without consent, or
        should not be on this site for any other reason. Reports go directly to the site operator.
      </p>
      <div className="mt-6">
        <TakedownForm botFields={<BotFields />} />
      </div>
    </div>
  );
}
