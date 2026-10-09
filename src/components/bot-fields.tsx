import { HONEYPOT_FIELD, TIMESTAMP_FIELD } from "@/auth/bot-check";

/**
 * Hidden anti-bot inputs. Rendered on the server so the timestamp reflects when the form
 * was actually served. The honeypot is visually hidden and excluded from autofill.
 */
export function BotFields() {
  return (
    <>
      {/* Server component on dynamic routes: rendered once per request, so the "impure" value is the intent. */}
      {/* eslint-disable-next-line react-hooks/purity */}
      <input type="hidden" name={TIMESTAMP_FIELD} value={Date.now()} />
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={`bf-${HONEYPOT_FIELD}`}>Website</label>
        <input
          id={`bf-${HONEYPOT_FIELD}`}
          name={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
    </>
  );
}
