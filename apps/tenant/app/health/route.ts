import { NextResponse } from "next/server";
import { checkHealth } from "../lib/health";

// Always run on-demand — never cache a liveness probe.
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await checkHealth();
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
