import { NextResponse, type NextRequest } from "next/server";
import { getImageStorage } from "@/media";
import { FakeImageStorage } from "@/media/fake";
import { verifyLocalPath } from "@/media/signing";
import { getSessionSecret } from "@/lib/age-gate";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  bin: "video/mp4",
  mp4: "video/mp4",
};

/**
 * Delivery route for the fake (local disk) provider. Exists only in development; in
 * production the storage is Bunny and this handler answers 404. Access requires a valid,
 * unexpired HMAC token for exactly this path, so guessing a key yields nothing.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return serveLocal(request, (await ctx.params).path, getImageStorage());
}

export async function serveLocal(
  request: NextRequest,
  segments: string[],
  storage: ReturnType<typeof getImageStorage>,
  now = new Date(),
) {
  if (!(storage instanceof FakeImageStorage)) return new NextResponse(null, { status: 404 });
  const key = segments.join("/");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9/_.-]{0,200}$/.test(key) || key.includes("..")) {
    return NextResponse.json({ error: "bad_path" }, { status: 400 });
  }
  const sp = request.nextUrl.searchParams;
  const verdict = verifyLocalPath(key, sp.get("expires"), sp.get("token"), getSessionSecret(), now);
  if (verdict !== "ok")
    return NextResponse.json(
      { error: verdict === "expired" ? "token_expired" : "forbidden" },
      { status: 403 },
    );

  const data = await storage.read(key);
  if (!data) return new NextResponse(null, { status: 404 });
  const ext = key.split(".").pop() ?? "";
  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      "content-type": TYPES[ext] ?? "application/octet-stream",
      "content-length": String(data.length),
      "cache-control": "private, no-store",
      "content-disposition": "inline",
      "x-robots-tag": "noindex, noimageindex",
    },
  });
}
