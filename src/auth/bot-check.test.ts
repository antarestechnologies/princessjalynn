import { describe, expect, it } from "vitest";
import { botCheck, HONEYPOT_FIELD, TIMESTAMP_FIELD } from "./bot-check";

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

describe("botCheck", () => {
  const now = 1_700_000_000_000;
  it("passes a human-speed submission", () => {
    expect(botCheck(form({ [TIMESTAMP_FIELD]: String(now - 5000) }), now)).toEqual({ ok: true });
  });
  it("flags a filled honeypot", () => {
    expect(
      botCheck(form({ [TIMESTAMP_FIELD]: String(now - 5000), [HONEYPOT_FIELD]: "http://x" }), now),
    ).toEqual({
      ok: false,
      reason: "honeypot",
    });
  });
  it("flags an instant submission", () => {
    expect(botCheck(form({ [TIMESTAMP_FIELD]: String(now - 200) }), now)).toEqual({
      ok: false,
      reason: "too_fast",
    });
  });
  it("flags a missing or ancient timestamp", () => {
    expect(botCheck(form({}), now)).toEqual({ ok: false, reason: "stale" });
    expect(botCheck(form({ [TIMESTAMP_FIELD]: String(now - 7 * 3600 * 1000) }), now)).toEqual({
      ok: false,
      reason: "stale",
    });
  });
});
