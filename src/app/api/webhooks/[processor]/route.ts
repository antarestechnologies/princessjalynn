import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { logger } from "@/lib/logger";
import { paymentDeps, processorForWebhook } from "@/payments";
import { ingestWebhook } from "@/payments/service";
import { WebhookSignatureError } from "@/payments/types";

export const dynamic = "force-dynamic";

/**
 * Processor webhook endpoint. Exempt from the age gate (see age-gate.ts); protected by the
 * adapter's signature check instead. Returns 200 once events are recorded, even if a handler
 * failed (the failure is stored on webhook_events for review), so the processor does not
 * retry forever. A bad signature is a 400 and nothing is stored.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ processor: string }> }) {
  const { processor: name } = await ctx.params;
  const processor = processorForWebhook(name);
  if (!processor) return NextResponse.json({ error: "unknown_processor" }, { status: 404 });
  const rawBody = await request.text();
  try {
    const result = await ingestWebhook(getDb(), processor, paymentDeps(), {
      headers: request.headers,
      rawBody,
    });
    if (result.failed)
      logger.warn({ processor: name, ...result }, "webhook events failed to apply");
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof WebhookSignatureError) {
      logger.warn({ processor: name, reason: err.message }, "webhook rejected");
      return NextResponse.json({ error: "bad_signature" }, { status: 400 });
    }
    logger.error({ err, processor: name }, "webhook ingest crashed");
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
