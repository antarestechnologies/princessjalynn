/**
 * Third-party age/identity verification, behind an interface so the vendor chosen after
 * the Phase 0 shortlist (PrivateAV, VerifyMy, Veriff, Yoti...) is a drop-in adapter.
 *
 * Contract:
 *  - `start` returns a URL to send the user to. The vendor does the verification; we never
 *    see documents or selfies.
 *  - The vendor reports back (redirect or webhook) and the adapter's route handler calls
 *    completeAgeVerification() with the outcome and the vendor's opaque reference.
 *  - We store only: provider name, reference, outcome, timestamps (non-negotiable #5).
 */
export interface AgeVerifier {
  readonly name: string;
  start(input: AgeVerificationStart): Promise<{ redirectUrl: string; providerRef?: string }>;
}

export interface AgeVerificationStart {
  userId: string;
  /** Our row id; the adapter passes it through so the callback can find the attempt. */
  verificationId: string;
  /** Absolute URL the vendor should send the user back to. */
  returnUrl: string;
}

export type AgeVerificationOutcome = "passed" | "failed";
