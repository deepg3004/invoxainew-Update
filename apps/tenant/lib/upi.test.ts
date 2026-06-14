import { describe, expect, it } from "vitest";
import { UTR_RE } from "./upi";

// UTR_RE is the format sanity-check on the buyer-submitted UPI reference (the
// `submitUpiRef` action runs `UTR_RE.test(raw.trim())`). It is deliberately a
// permissive 6–40 alphanumeric check, NOT the trust boundary — the seller (or,
// for instant-delivery goods, the manual-confirm queue) verifies the real money.
// These tests lock that contract so it can't silently widen.

describe("UTR_RE", () => {
  it("accepts valid UPI references (6–40 alphanumeric)", () => {
    for (const ref of [
      "123456", // min length, 12-digit-style
      "123456789012", // classic 12-digit UTR
      "ABCDEF123456", // RRN-style uppercase
      "aBc123XyZ789", // mixed case
      "a".repeat(40), // max length
    ]) {
      expect(UTR_RE.test(ref)).toBe(true);
    }
  });

  it("rejects references that are too short or too long", () => {
    expect(UTR_RE.test("12345")).toBe(false); // 5 chars
    expect(UTR_RE.test("a".repeat(41))).toBe(false); // 41 chars
    expect(UTR_RE.test("")).toBe(false);
  });

  it("rejects whitespace, separators and special characters", () => {
    for (const ref of [
      "1234 5678", // embedded space
      "1234-5678", // hyphen
      "1234_5678", // underscore
      "abc@1234", // symbol
      "₹1234567", // currency symbol
      " 123456", // leading space (regex is anchored)
      "123456 ", // trailing space
      "1234\n56", // newline (guards a multi-line injection-y value)
    ]) {
      expect(UTR_RE.test(ref)).toBe(false);
    }
  });

  it("matches a padded value only after the trim the action applies", () => {
    const raw = "   123456789012   ";
    expect(UTR_RE.test(raw)).toBe(false); // untrimmed is rejected
    expect(UTR_RE.test(raw.trim())).toBe(true); // submitUpiRef trims before testing
  });
});
