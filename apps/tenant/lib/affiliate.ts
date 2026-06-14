import { cookies } from "next/headers";
import { resolveAffiliateAttribution } from "@invoxai/db";

/**
 * Read the affiliate code captured by <AffiliateCapture> from the `invox_ref`
 * cookie (last-touch, 30 days). Server-side, called from the checkout actions so
 * the order can be attributed to the affiliate that drove it. Defensive: trimmed
 * + length-capped, never throws. The code is RE-RESOLVED against active
 * affiliates at checkout (resolveAffiliateAttribution), so a forged cookie can't
 * fabricate an attribution or inflate commission.
 */
export async function readRefCookie(): Promise<string | null> {
  const raw = (await cookies()).get("invox_ref")?.value;
  if (!raw) return null;
  const code = decodeURIComponent(raw).trim().slice(0, 40);
  return code || null;
}

/**
 * Resolve the order's affiliate attribution from the ref cookie at checkout.
 * Pass the SERVER-TRUSTED post-discount amount so the recorded commission can't
 * be inflated by the client. Returns all-null/zero when there's no valid ref.
 */
export async function affiliateAttribution(tenantId: string, amountPaise: number) {
  return resolveAffiliateAttribution(tenantId, await readRefCookie(), amountPaise);
}
