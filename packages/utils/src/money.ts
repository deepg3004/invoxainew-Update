/**
 * Money + commission conversions for the rupee/percent UI edge.
 *
 * Storage is always integer paise (₹1 = 100 paise) and integer basis points
 * (1% = 100 bps), so all money math stays in integers. These helpers convert
 * only at the boundary where a human enters or reads a value. Keep them pure
 * and dependency-free — they run on both server and client.
 */

export const PAISE_PER_RUPEE = 100;
export const BPS_PER_PERCENT = 100;

/** Integer paise → a fixed 2-decimal rupee string, e.g. 14900 → "149.00". */
export function paiseToRupeeString(paise: number): string {
  return (paise / PAISE_PER_RUPEE).toFixed(2);
}

/** Integer paise → "₹149.00" for display. */
export function formatRupees(paise: number): string {
  return `₹${paiseToRupeeString(paise)}`;
}

/**
 * Parse a user-entered rupee amount (e.g. "149", "149.5", "₹1,499.00") into
 * integer paise. Rejects negatives, blanks, and non-numeric input so bad
 * pricing can't silently become 0. Rounds to the nearest paise.
 */
export function rupeeStringToPaise(
  input: string,
): { ok: true; paise: number } | { ok: false; message: string } {
  const cleaned = input.replace(/[₹,\s]/g, "");
  if (cleaned === "") return { ok: false, message: "Enter an amount." };
  const rupees = Number(cleaned);
  if (!Number.isFinite(rupees)) return { ok: false, message: "Not a number." };
  if (rupees < 0) return { ok: false, message: "Must be zero or more." };
  return { ok: true, paise: Math.round(rupees * PAISE_PER_RUPEE) };
}

/** Integer basis points → percent string, e.g. 250 → "2.5". */
export function bpsToPercentString(bps: number): string {
  // Trim a trailing ".0" so whole percents read cleanly (250 → "2.5", 300 → "3").
  return String(bps / BPS_PER_PERCENT);
}

/**
 * Parse a user-entered commission percent (e.g. "2.5", "3%") into integer
 * basis points. Bounded to 0–100% so a fat-fingered 1000% can't ship.
 */
export function percentStringToBps(
  input: string,
): { ok: true; bps: number } | { ok: false; message: string } {
  const cleaned = input.replace(/[%\s]/g, "");
  if (cleaned === "") return { ok: false, message: "Enter a percent." };
  const percent = Number(cleaned);
  if (!Number.isFinite(percent)) return { ok: false, message: "Not a number." };
  if (percent < 0 || percent > 100) {
    return { ok: false, message: "Must be between 0 and 100." };
  }
  return { ok: true, bps: Math.round(percent * BPS_PER_PERCENT) };
}
