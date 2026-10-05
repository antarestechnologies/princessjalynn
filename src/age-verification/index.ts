import { getEnv } from "@/env";
import type { AgeVerifier } from "./provider";
import { StubAgeVerifier } from "./stub";

let cached: AgeVerifier | undefined;

export function getAgeVerifier(): AgeVerifier {
  if (cached) return cached;
  const env = getEnv();
  switch (env.AGE_VERIFIER) {
    case "stub":
      cached = new StubAgeVerifier(env.NODE_ENV !== "production" || env.ALLOW_STUB_AGE_VERIFIER);
      break;
  }
  return cached;
}

export function setAgeVerifierForTests(v: AgeVerifier | undefined) {
  cached = v;
}

export type { AgeVerifier } from "./provider";
