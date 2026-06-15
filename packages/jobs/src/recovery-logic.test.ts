import { describe, expect, it } from "vitest";
import { buildResumeUrl, isInRecoveryWindow } from "./recovery-logic";

// buildResumeUrl is the "come back and finish" link in every recovery email — if it
// points at the wrong place the nudge is useless. isInRecoveryWindow guards the
// send window. Both are pure; these tests pin the contract.

describe("buildResumeUrl", () => {
  it("uses the primary custom domain when present", () => {
    expect(
      buildResumeUrl({ username: "acme", primaryDomain: "shop.acme.com", paymentPageSlug: "vip" }),
    ).toBe("https://shop.acme.com/pay/vip");
  });

  it("falls back to the username subdomain when there is no custom domain", () => {
    expect(buildResumeUrl({ username: "acme", paymentPageSlug: "vip" })).toBe(
      "https://acme.invoxai.io/pay/vip",
    );
  });

  it("routes to the product page for a product checkout", () => {
    expect(buildResumeUrl({ username: "acme", productSlug: "ebook" })).toBe(
      "https://acme.invoxai.io/p/ebook",
    );
  });

  it("prefers the payment page over the product when both are set", () => {
    expect(
      buildResumeUrl({ username: "acme", paymentPageSlug: "vip", productSlug: "ebook" }),
    ).toBe("https://acme.invoxai.io/pay/vip");
  });

  it("falls back to the store homepage when no specific item is known (cart/course)", () => {
    expect(buildResumeUrl({ username: "acme" })).toBe("https://acme.invoxai.io/store");
  });

  it("treats a blank/whitespace primary domain as absent", () => {
    expect(buildResumeUrl({ username: "acme", primaryDomain: "   ", productSlug: "x" })).toBe(
      "https://acme.invoxai.io/p/x",
    );
  });
});

describe("isInRecoveryWindow", () => {
  const now = new Date("2026-06-14T12:00:00Z");
  const opts = { minAgeMinutes: 30, maxAgeHours: 24 };

  it("rejects a checkout younger than the minimum age (buyer may still be paying)", () => {
    const created = new Date(now.getTime() - 10 * 60_000); // 10 min ago
    expect(isInRecoveryWindow(created, now, opts)).toBe(false);
  });

  it("accepts a checkout in the window (1 hour ago)", () => {
    const created = new Date(now.getTime() - 60 * 60_000);
    expect(isInRecoveryWindow(created, now, opts)).toBe(true);
  });

  it("accepts exactly at the minimum age boundary", () => {
    const created = new Date(now.getTime() - 30 * 60_000);
    expect(isInRecoveryWindow(created, now, opts)).toBe(true);
  });

  it("rejects a checkout older than the max age (stale nudge)", () => {
    const created = new Date(now.getTime() - 25 * 3_600_000); // 25h ago
    expect(isInRecoveryWindow(created, now, opts)).toBe(false);
  });
});
