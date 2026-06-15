import { describe, expect, it } from "vitest";
import { matchesSegment, normalizeSegment } from "./broadcasts";

// Broadcast segments decide who an email blast reaches. These predicates are the
// trust boundary for the recipient snapshot, so pin the contract:
//   CUSTOMERS = paid ≥1 · LEADS = never paid · ALL = everyone.
describe("normalizeSegment", () => {
  it("accepts the known segments and defaults the rest to ALL", () => {
    expect(normalizeSegment("ALL")).toBe("ALL");
    expect(normalizeSegment("CUSTOMERS")).toBe("CUSTOMERS");
    expect(normalizeSegment("LEADS")).toBe("LEADS");
    expect(normalizeSegment("everyone")).toBe("ALL");
    expect(normalizeSegment("")).toBe("ALL");
    expect(normalizeSegment(null)).toBe("ALL");
    expect(normalizeSegment(42)).toBe("ALL");
  });
});

describe("matchesSegment", () => {
  const lead = { paidCount: 0 };
  const customer = { paidCount: 1 };
  const vip = { paidCount: 3 };

  it("ALL includes everyone", () => {
    expect(matchesSegment(lead, "ALL")).toBe(true);
    expect(matchesSegment(customer, "ALL")).toBe(true);
    expect(matchesSegment(vip, "ALL")).toBe(true);
  });

  it("CUSTOMERS includes anyone who has paid at least once", () => {
    expect(matchesSegment(lead, "CUSTOMERS")).toBe(false);
    expect(matchesSegment(customer, "CUSTOMERS")).toBe(true);
    expect(matchesSegment(vip, "CUSTOMERS")).toBe(true);
  });

  it("LEADS includes only those who have never paid", () => {
    expect(matchesSegment(lead, "LEADS")).toBe(true);
    expect(matchesSegment(customer, "LEADS")).toBe(false);
    expect(matchesSegment(vip, "LEADS")).toBe(false);
  });

  it("CUSTOMERS and LEADS partition everyone (no overlap, full cover)", () => {
    for (const c of [lead, customer, vip]) {
      expect(matchesSegment(c, "CUSTOMERS") !== matchesSegment(c, "LEADS")).toBe(true);
    }
  });
});
