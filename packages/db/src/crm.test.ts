import { describe, expect, it } from "vitest";
import { contactStage, CRM_STAGES } from "./crm";

// contactStage derives a contact's CRM pipeline position from their activity. It's
// the single source of truth for the funnel counts + per-contact badge + stage
// filter, so a wrong threshold would mis-segment the whole CRM. Pure; pinned here.

describe("contactStage", () => {
  it("is VIP for a repeat buyer (>= 2 paid orders)", () => {
    expect(contactStage({ paidCount: 2, orderCount: 3 })).toBe("VIP");
    expect(contactStage({ paidCount: 5, orderCount: 5 })).toBe("VIP");
  });

  it("is CUSTOMER for exactly one paid order", () => {
    expect(contactStage({ paidCount: 1, orderCount: 1 })).toBe("CUSTOMER");
    // One paid + extra unpaid attempts is still a single-purchase customer.
    expect(contactStage({ paidCount: 1, orderCount: 3 })).toBe("CUSTOMER");
  });

  it("is ENGAGED when a checkout was started but never paid", () => {
    expect(contactStage({ paidCount: 0, orderCount: 1 })).toBe("ENGAGED");
    expect(contactStage({ paidCount: 0, orderCount: 4 })).toBe("ENGAGED");
  });

  it("is LEAD when there is no checkout activity at all", () => {
    expect(contactStage({ paidCount: 0, orderCount: 0 })).toBe("LEAD");
  });

  it("prioritises paid status over started-checkout count", () => {
    // A paid order outranks any number of abandoned ones → never ENGAGED.
    expect(contactStage({ paidCount: 1, orderCount: 10 })).toBe("CUSTOMER");
  });

  it("only ever returns a known stage", () => {
    for (const sample of [
      { paidCount: 0, orderCount: 0 },
      { paidCount: 0, orderCount: 2 },
      { paidCount: 1, orderCount: 1 },
      { paidCount: 9, orderCount: 9 },
    ]) {
      expect(CRM_STAGES).toContain(contactStage(sample));
    }
  });
});
