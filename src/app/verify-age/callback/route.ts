import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Return URL handed to the age-verification vendor. The stub never calls it. When a real
 * adapter is added it will validate the vendor's signed result here and call
 * completeAgeVerification(); until then it only sends the user back to their account.
 */
export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/account", request.nextUrl), 303);
}
