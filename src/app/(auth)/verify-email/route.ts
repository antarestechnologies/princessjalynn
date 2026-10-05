import { NextResponse, type NextRequest } from "next/server";
import { verifyEmail } from "@/auth/service";
import { getDb } from "@/db/client";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/** Landing route for the link in the verification email. Consumes the one-time token. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  try {
    const result = await verifyEmail(getDb(), token);
    const dest = result.ok ? "/login?verified=1" : `/verify-email/invalid?reason=${result.error}`;
    return NextResponse.redirect(new URL(dest, request.nextUrl), 303);
  } catch (err) {
    logger.error({ err }, "email verification failed");
    return NextResponse.redirect(
      new URL("/verify-email/invalid?reason=error", request.nextUrl),
      303,
    );
  }
}
