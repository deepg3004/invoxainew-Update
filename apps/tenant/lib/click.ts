import { cookies } from "next/headers";

export interface ClickIds {
  fbclid?: string | null;
  gclid?: string | null;
  ttclid?: string | null;
  fbp?: string | null;
}

const KEYS = ["fbclid", "gclid", "ttclid", "fbp"] as const;

/**
 * Read the ad-click attribution the client stored in the `invox_click` cookie on
 * landing (see UtmCapture). Server-side, called from the checkout actions so the
 * order is stamped with the click IDs that drove it (for Meta CAPI / Google
 * enhanced conversions + reporting). Defensive: only the known keys, trimmed +
 * capped; never throws on malformed input.
 */
export async function readClickIds(): Promise<ClickIds | null> {
  const raw = (await cookies()).get("invox_click")?.value;
  if (!raw) return null;
  try {
    const obj = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
    const out: ClickIds = {};
    let any = false;
    for (const k of KEYS) {
      const v = obj[k];
      if (typeof v === "string" && v.trim()) {
        out[k] = v.trim().slice(0, 255);
        any = true;
      }
    }
    return any ? out : null;
  } catch {
    return null;
  }
}
