import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getRedis } from "@/lib/redis";
import { verifyOtp, persistTelegramSession } from "@/lib/telegram-user-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * MUST match send-code's normalisation exactly — Telegram's auth.signIn
 * rejects (PHONE_NUMBER_INVALID) unless the phone string is byte-identical to
 * the one passed to sendCode.
 */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (raw.trim().startsWith("+") && digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }
  return null;
}

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    phone?: string;
    otp?: string;
    phoneCodeHash?: string;
    sessionKey?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { phone, otp, phoneCodeHash, sessionKey } = body;
  if (!phone || !otp || !phoneCodeHash || !sessionKey) {
    return NextResponse.json(
      { error: "phone, otp, phoneCodeHash and sessionKey are required" },
      { status: 400 },
    );
  }

  // Normalise identically to send-code so auth.signIn gets the same string.
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  }

  try {
    const result = await verifyOtp(normalizedPhone, otp, phoneCodeHash, sessionKey);

    // 2FA account — ask the client for the cloud password (same sessionKey).
    if (result.status === "password_needed") {
      return NextResponse.json({ ok: true, passwordNeeded: true, sessionKey });
    }

    const tgUser = await persistTelegramSession(user.id, normalizedPhone, result.user);

    const redis = getRedis();
    if (redis) await redis.del(`tg_channels:${user.id}`);

    return NextResponse.json({ ok: true, telegramUser: tgUser });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
