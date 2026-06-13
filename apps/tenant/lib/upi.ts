/**
 * Shape of a UPI transaction reference (UTR / RRN). UPI references are 6–40
 * alphanumeric chars depending on the rail/app (12-digit UTR, longer RRNs, app
 * order ids). Kept deliberately permissive — the SELLER manually verifies the
 * actual money received against this reference before confirming, so this is a
 * sanity check, not the trust boundary. Shared by every manual-UPI checkout
 * surface (pay page, product, course, cart) so they validate identically.
 */
export const UTR_RE = /^[A-Za-z0-9]{6,40}$/;

/**
 * Result of starting a manual-UPI payment session (the per-surface
 * `start*UpiSession` server actions). On success the buyer is shown a dynamic QR
 * + the UNIQUE payable amount (`payAmountPaise` = sale price + a small nonce, so
 * an incoming credit maps to one order) and a countdown to `expiresAt` (ISO).
 * The owning tenant's UPI id/payee are passed to the panel separately (the buy
 * box already has them), so this stays minimal.
 */
export type StartUpiSessionResult =
  | { ok: true; buyerPaymentId: string; payAmountPaise: number; expiresAt: string }
  | { ok: false; error: string };

/**
 * Result of submitting the buyer's UPI reference (shared `submitUpiRef`).
 * `confirmed` true = auto-confirmed (paid + access granted now); false = held for
 * the seller to confirm manually. `expired` flags a timed-out session so the UI
 * can offer "start again".
 */
export type SubmitUpiRefResult =
  | { ok: true; confirmed: boolean }
  | { ok: false; error: string; expired?: boolean };
