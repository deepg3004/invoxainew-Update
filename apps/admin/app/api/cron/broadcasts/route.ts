import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@invoxai/config";
import { sweepBroadcasts } from "@invoxai/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Phase 14 — scheduled sweep that delivers QUEUED email broadcasts. Point an
 * external scheduler at it every ~5 minutes with `Authorization: Bearer
 * <CRON_SECRET>` (same secret as the recovery + sequences crons).
 *
 * Disabled (503) when CRON_SECRET is unset. The sweep claims each recipient
 * atomically before sending, so concurrent runs can't double-send, and it never
 * throws. Email itself is env-gated on RESEND_API_KEY (skipped until configured).
 */
export async function POST(request: NextRequest) {
  const env = serverEnv();
  if (!env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "cron_disabled" }, { status: 503 });
  }

  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${env.CRON_SECRET}`;
  if (auth.length !== expected.length || auth !== expected) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const summary = await sweepBroadcasts();
  return NextResponse.json({ ok: true, ...summary });
}
