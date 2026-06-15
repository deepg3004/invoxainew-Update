// Growth G1.6 — pure A/B helpers (bucketing + result summary). No deps so they're
// trivially unit-testable and shared by the public serve path + the seller stats UI.

export type Variant = "A" | "B";

/**
 * Bucket a visitor into a variant from a uniform random number in [0, 1). `splitBps`
 * is the share of traffic sent to variant B in basis points (5000 = 50%). Pure +
 * deterministic for a given `rand`, so the caller persists the result in a cookie.
 */
export function pickVariant(rand: number, splitBps = 5000): Variant {
  if (!Number.isFinite(rand)) return "A"; // garbage input → control
  const r = Math.min(Math.max(rand, 0), 0.999999);
  const bps = Math.min(Math.max(Math.floor(splitBps), 0), 10000);
  return r * 10000 < bps ? "B" : "A";
}

export interface ExperimentCounts {
  aViews: number;
  bViews: number;
  aConversions: number;
  bConversions: number;
}

export interface ExperimentSummary {
  aRate: number; // conversion rate 0..1
  bRate: number;
  leader: Variant | "tie" | "none";
  /** Relative lift of the leader over the other, 0..∞ (0 when not computable). */
  liftPct: number;
}

/** Conversion rate, guarding divide-by-zero (0 views → 0 rate). Pure. */
export function conversionRate(conversions: number, views: number): number {
  if (views <= 0) return 0;
  return Math.max(0, conversions) / views;
}

/**
 * Summarise an experiment for the seller: per-variant conversion rate, which variant
 * leads, and the leader's relative lift. "none" until both variants have a view;
 * "tie" when the rates are equal. Pure.
 */
export function summarizeExperiment(c: ExperimentCounts): ExperimentSummary {
  const aRate = conversionRate(c.aConversions, c.aViews);
  const bRate = conversionRate(c.bConversions, c.bViews);

  if (c.aViews <= 0 || c.bViews <= 0) {
    return { aRate, bRate, leader: "none", liftPct: 0 };
  }
  if (aRate === bRate) return { aRate, bRate, leader: "tie", liftPct: 0 };

  const leader: Variant = bRate > aRate ? "B" : "A";
  const hi = Math.max(aRate, bRate);
  const lo = Math.min(aRate, bRate);
  const liftPct = lo > 0 ? ((hi - lo) / lo) * 100 : 100;
  return { aRate, bRate, leader, liftPct };
}
