import { describe, expect, it, vi } from "vitest";
import { ConsoleMailer, parseAddress, SendGridMailer } from "./mailer";

describe("parseAddress", () => {
  it("handles bare and named addresses", () => {
    expect(parseAddress("a@b.co")).toEqual({ email: "a@b.co" });
    expect(parseAddress("Members <a@b.co>")).toEqual({ email: "a@b.co", name: "Members" });
    expect(parseAddress('"Members" <a@b.co>')).toEqual({ email: "a@b.co", name: "Members" });
  });
});

describe("SendGridMailer", () => {
  it("posts the expected payload with tracking disabled", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 202 }));
    const m = new SendGridMailer(
      "sg-key",
      "Members <no-reply@x.test>",
      fetchImpl as unknown as typeof fetch,
    );
    await m.send({ to: "fan@example.com", subject: "Hi", text: "body" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.sendgrid.com/v3/mail/send");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer sg-key");
    const body = JSON.parse(init.body as string);
    expect(body.personalizations[0].to[0].email).toBe("fan@example.com");
    expect(body.from).toEqual({ email: "no-reply@x.test", name: "Members" });
    expect(body.tracking_settings.click_tracking.enable).toBe(false);
  });

  it("throws on a non-2xx response", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 401 }));
    const m = new SendGridMailer("k", "a@b.co", fetchImpl as unknown as typeof fetch);
    await expect(m.send({ to: "x@y.z", subject: "s", text: "t" })).rejects.toThrow(/401/);
  });
});

describe("ConsoleMailer", () => {
  it("refuses to run in production", async () => {
    const prev = process.env.NODE_ENV;
    vi.stubEnv("NODE_ENV", "production");
    try {
      await expect(
        new ConsoleMailer().send({ to: "a@b.co", subject: "s", text: "t" }),
      ).rejects.toThrow(/production/);
    } finally {
      vi.stubEnv("NODE_ENV", prev ?? "test");
    }
  });
});
