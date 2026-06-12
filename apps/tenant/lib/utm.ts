import { cookies } from "next/headers";

export interface Utm {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  content?: string | null;
  term?: string | null;
}

const KEYS = ["source", "medium", "campaign", "content", "term"] as const;

/**
 * Read the campaign attribution the client stored in the `invox_utm` cookie on
 * landing (see UtmCapture). Server-side, called from the checkout actions so the
 * order is stamped with the source that drove it. Defensive: only the 5 known
 * keys, trimmed and length-capped; never throws on malformed input.
 */
export async function readUtmCookie(): Promise<Utm | null> {
  const raw = (await cookies()).get("invox_utm")?.value;
  if (!raw) return null;
  try {
    // The client writes the cookie percent-encoded (document.cookie); decode
    // before parsing. Decoding plain JSON is a no-op, so this is safe either way.
    const obj = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
    const out: Utm = {};
    let any = false;
    for (const k of KEYS) {
      const v = obj[k];
      if (typeof v === "string" && v.trim()) {
        out[k] = v.trim().slice(0, 120);
        any = true;
      }
    }
    return any ? out : null;
  } catch {
    return null;
  }
}
