import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static guardrail for the Phase 6 auth review. Fails the build if someone adds a server
 * action, admin route handler or account route without an authorization check, so the review
 * stays true as the code grows. Public entry points are listed explicitly with a reason.
 */
const ROOT = path.resolve(__dirname, "..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const rel = (p: string) => path.relative(ROOT, p).split(path.sep).join("/");
const files = walk(ROOT).filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith(".test.ts"));

const GUARDS =
  /\b(requireAdmin|requireUser|requireVerifiedUser|requireVaultAccess|vaultActorOrNull|getCurrentUser)\s*\(/;

/** Server actions that are intentionally callable without a session, and why. */
const PUBLIC_ACTIONS: Record<string, string> = {
  "auth/actions.ts:signUpAction": "creates the account; bot-checked and rate limited",
  "auth/actions.ts:signInAction": "creates the session; bot-checked and rate limited",
  "auth/actions.ts:forgotPasswordAction":
    "public by design; bot-checked, rate limited, no account enumeration",
  "auth/actions.ts:resetPasswordAction": "authorised by the single-use reset token",
  "app/gate/actions.ts:enterGateAction": "sets the 18+ attestation cookie only",
  "app/legal/takedown/actions.ts:submitTakedownAction":
    "public report form; bot-checked and rate limited",
};

/** Route handlers that are intentionally public, and why. */
const PUBLIC_ROUTES: Record<string, string> = {
  "app/api/health/route.ts": "liveness only; returns no data",
  "app/api/webhooks/[processor]/route.ts": "authenticated by processor signature",
  "app/api/media/local/[...path]/route.ts":
    "authorised by an HMAC token bound to path and expiry; 404 outside dev storage",
  "app/(auth)/verify-email/route.ts": "authorised by the single-use verification token",
  "app/verify-age/callback/route.ts":
    "redirect only; real adapter must verify the vendor signature",
};

/** Each exported async function's text runs from its declaration to the next top-level export. */
function exportedFunctions(src: string): { name: string; body: string }[] {
  const re = /^export\s+async\s+function\s+(\w+)\s*\(/gm;
  const hits = [...src.matchAll(re)];
  return hits.map((m) => {
    const from = m.index!;
    const nextExport = src.slice(from + 1).search(/^export\s/m);
    const to = nextExport === -1 ? src.length : from + 1 + nextExport;
    return { name: m[1], body: src.slice(from, to) };
  });
}

describe("auth guard inventory", () => {
  const actionFiles = files.filter((f) =>
    /^\s*["']use server["']/m.test(readFileSync(f, "utf8").slice(0, 200)),
  );

  it("finds the server action files (sanity check)", () => {
    expect(actionFiles.length).toBeGreaterThanOrEqual(6);
  });

  for (const f of actionFiles) {
    const src = readFileSync(f, "utf8");
    for (const fn of exportedFunctions(src)) {
      const key = `${rel(f)}:${fn.name}`;
      it(`server action ${key} checks auth or is listed as public`, () => {
        if (PUBLIC_ACTIONS[key]) return;
        expect(GUARDS.test(fn.body), `${key} has no auth guard`).toBe(true);
      });
    }
  }

  const routeFiles = files.filter((f) => f.endsWith(`${path.sep}route.ts`));
  for (const f of routeFiles) {
    const key = rel(f);
    it(`route ${key} checks auth or is listed as public`, () => {
      if (PUBLIC_ROUTES[key]) return;
      const src = readFileSync(f, "utf8");
      for (const fn of exportedFunctions(src).filter((x) =>
        /^(GET|POST|PUT|PATCH|DELETE)$/.test(x.name),
      )) {
        expect(GUARDS.test(fn.body), `${key} ${fn.name} has no auth guard`).toBe(true);
      }
    });
  }

  it("every state-changing cookie-auth route handler rejects cross-site requests", () => {
    for (const f of routeFiles) {
      const key = rel(f);
      if (PUBLIC_ROUTES[key]) continue;
      const src = readFileSync(f, "utf8");
      for (const fn of exportedFunctions(src).filter((x) =>
        /^(POST|PUT|PATCH|DELETE)$/.test(x.name),
      )) {
        expect(
          fn.body.includes("crossSiteRejection(request)"),
          `${key} ${fn.name} lacks a cross-site check`,
        ).toBe(true);
      }
    }
  });

  it("every admin page is under the admin layout, which requires an admin", () => {
    const layout = readFileSync(path.join(ROOT, "app/admin/layout.tsx"), "utf8");
    expect(layout).toMatch(/await requireAdmin\(\)/);
  });

  it("vault pages and routes require a fresh vault unlock, not just admin", () => {
    const vault = files.filter(
      (f) =>
        rel(f).includes("vault") && /(page|route)\.tsx?$/.test(f) && !rel(f).includes("unlock"),
    );
    expect(vault.length).toBeGreaterThanOrEqual(6);
    for (const f of vault)
      expect(readFileSync(f, "utf8"), rel(f)).toMatch(/requireVaultAccess|vaultActorOrNull/);
  });

  it("public allow-lists only name files that exist", () => {
    for (const k of Object.keys(PUBLIC_ROUTES)) expect(files.map(rel), k).toContain(k);
    for (const k of Object.keys(PUBLIC_ACTIONS))
      expect(files.map(rel), k).toContain(k.split(":")[0]);
  });
});
