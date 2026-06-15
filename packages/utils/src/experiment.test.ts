import { describe, expect, it } from "vitest";
import {
  pickVariant,
  conversionRate,
  summarizeExperiment,
} from "./experiment";

describe("pickVariant", () => {
  it("splits 50/50 at the default split", () => {
    expect(pickVariant(0.2)).toBe("B"); // 0.2*10000=2000 < 5000
    expect(pickVariant(0.49)).toBe("B");
    expect(pickVariant(0.5)).toBe("A"); // 5000 not < 5000
    expect(pickVariant(0.9)).toBe("A");
  });

  it("respects a custom split (bps to B)", () => {
    expect(pickVariant(0.25, 3000)).toBe("B"); // 2500 < 3000
    expect(pickVariant(0.35, 3000)).toBe("A"); // 3500 not < 3000
    expect(pickVariant(0.99, 10000)).toBe("B"); // all traffic to B
    expect(pickVariant(0.0, 0)).toBe("A"); // no traffic to B
  });

  it("clamps out-of-range / invalid rand defensively", () => {
    expect(pickVariant(-1)).toBe("B"); // clamped to ~0 → B
    expect(pickVariant(2)).toBe("A"); // clamped to <1 → 9999.99 ≥ 5000 → A
    expect(pickVariant(NaN)).toBe("A"); // garbage → control
  });
});

describe("conversionRate", () => {
  it("computes conversions / views", () => {
    expect(conversionRate(5, 100)).toBeCloseTo(0.05);
    expect(conversionRate(1, 4)).toBe(0.25);
  });

  it("returns 0 when there are no views (no divide-by-zero)", () => {
    expect(conversionRate(0, 0)).toBe(0);
    expect(conversionRate(3, 0)).toBe(0);
  });
});

describe("summarizeExperiment", () => {
  it("reports 'none' until both variants have a view", () => {
    expect(summarizeExperiment({ aViews: 0, bViews: 10, aConversions: 0, bConversions: 1 }).leader).toBe("none");
    expect(summarizeExperiment({ aViews: 10, bViews: 0, aConversions: 1, bConversions: 0 }).leader).toBe("none");
  });

  it("names the higher-converting variant as leader with relative lift", () => {
    // A: 10/100 = 10%, B: 20/100 = 20% → B leads, lift = (0.2-0.1)/0.1 = 100%.
    const s = summarizeExperiment({ aViews: 100, bViews: 100, aConversions: 10, bConversions: 20 });
    expect(s.leader).toBe("B");
    expect(s.aRate).toBeCloseTo(0.1);
    expect(s.bRate).toBeCloseTo(0.2);
    expect(s.liftPct).toBeCloseTo(100);
  });

  it("calls equal rates a tie", () => {
    const s = summarizeExperiment({ aViews: 50, bViews: 50, aConversions: 5, bConversions: 5 });
    expect(s.leader).toBe("tie");
    expect(s.liftPct).toBe(0);
  });

  it("handles a leader over a zero-rate variant (100% lift floor)", () => {
    const s = summarizeExperiment({ aViews: 100, bViews: 100, aConversions: 0, bConversions: 5 });
    expect(s.leader).toBe("B");
    expect(s.liftPct).toBe(100);
  });
});
