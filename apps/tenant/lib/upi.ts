/**
 * Shape of a UPI transaction reference (UTR / RRN). UPI references are 6–40
 * alphanumeric chars depending on the rail/app (12-digit UTR, longer RRNs, app
 * order ids). Kept deliberately permissive — the SELLER manually verifies the
 * actual money received against this reference before confirming, so this is a
 * sanity check, not the trust boundary. Shared by every manual-UPI checkout
 * surface (pay page, product, course, cart) so they validate identically.
 */
export const UTR_RE = /^[A-Za-z0-9]{6,40}$/;
