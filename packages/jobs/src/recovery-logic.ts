// Growth G1.2 — pure helpers for abandoned-checkout recovery. No db/email imports
// so they're trivially unit-testable; the orchestrator (recovery.ts) wires these to
// the data + send layers.

/**
 * The URL a recovery email sends the buyer back to, to finish paying. Prefers the
 * tenant's primary custom domain, then the username subdomain. Routes to the
 * original surface when known (payment page → /pay/<slug>, product → /p/<slug>),
 * else the store homepage. Pure.
 */
export function buildResumeUrl(opts: {
  username: string;
  primaryDomain?: string | null;
  paymentPageSlug?: string | null;
  productSlug?: string | null;
}): string {
  const host = opts.primaryDomain?.trim() || `${opts.username}.invoxai.io`;
  const base = `https://${host}`;
  if (opts.paymentPageSlug) return `${base}/pay/${opts.paymentPageSlug}`;
  if (opts.productSlug) return `${base}/p/${opts.productSlug}`;
  return `${base}/store`;
}

/**
 * Is an abandoned checkout inside the recovery window — old enough to be truly
 * abandoned (not still being paid) but not so old a nudge is pointless/spammy? The
 * DB query already filters by this; this mirrors it as a guard + documents intent.
 * Pure.
 */
export function isInRecoveryWindow(
  createdAt: Date,
  now: Date,
  opts: { minAgeMinutes: number; maxAgeHours: number },
): boolean {
  const ageMs = now.getTime() - createdAt.getTime();
  return ageMs >= opts.minAgeMinutes * 60_000 && ageMs <= opts.maxAgeHours * 3_600_000;
}
