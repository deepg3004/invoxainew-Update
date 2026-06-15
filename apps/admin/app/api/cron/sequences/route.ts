import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@invoxai/config";
import { sweepSequences } from "@invoxai/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Growth G1.3 — scheduled sweep that advances due drip-sequence enrolments by one
 * step. Point an external scheduler at it every ~15 minutes with
 * `Authorization: Bearer <CRON_SECRET>` (same secret as the recovery cron).
 *
 * Disabled (503) when CRON_SECRET is unset. The sweep claims each enrolment
 * atomically before sending, so concurrent runs can't double-send, and it never throws.
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

  const summary = await sweepSequences();
  return NextResponse.json({ ok: true, ...summary });
}
