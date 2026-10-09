import type { AgeVerifier, AgeVerificationStart } from "./provider";

/**
 * Development stand-in. Sends the user to an internal page with "Pass" and "Fail" buttons.
 * Refuses to start unless explicitly allowed, so a production deploy that forgot to
 * configure a real vendor fails closed instead of verifying everyone.
 */
export class StubAgeVerifier implements AgeVerifier {
  readonly name = "stub";
  constructor(private readonly allowed: boolean) {}

  async start(input: AgeVerificationStart) {
    if (!this.allowed) {
      throw new Error(
        "Age verification is not configured. The stub verifier is disabled in production; set AGE_VERIFIER to a real vendor.",
      );
    }
    const url = new URL("/verify-age/stub", input.returnUrl);
    url.searchParams.set("v", input.verificationId);
    return { redirectUrl: url.toString(), providerRef: `stub-${input.verificationId}` };
  }
}
