import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyPaymentSignatureWithKeys } from "./razorpay";

// verifyPaymentSignatureWithKeys is the AUTHORITATIVE confirmation for a buyer
// payment (synchronous verify model): the seller's own secret signs
// `${order_id}|${payment_id}` and we recompute it. If this check is ever wrong
// (accepts a bad signature, or rejects a good one), a buyer order is marked PAID
// without proof — or a real payment can't be confirmed. These tests pin the
// contract and the constant-time/length-mismatch edge cases.

const SECRET = "seller_test_secret_abc123";
const ORDER_ID = "order_Nabc123XYZ";
const PAYMENT_ID = "pay_Ndef456UVW";

/** Produce a genuine Razorpay-style signature with a given secret. */
function sign(orderId: string, paymentId: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
}

describe("verifyPaymentSignatureWithKeys", () => {
  it("accepts a signature produced with the seller's secret", () => {
    const signature = sign(ORDER_ID, PAYMENT_ID, SECRET);
    expect(
      verifyPaymentSignatureWithKeys({
        orderId: ORDER_ID,
        paymentId: PAYMENT_ID,
        signature,
        keySecret: SECRET,
      }),
    ).toBe(true);
  });

  it("rejects a signature made with a different secret (forgery)", () => {
    const forged = sign(ORDER_ID, PAYMENT_ID, "attacker_guessed_secret");
    expect(
      verifyPaymentSignatureWithKeys({
        orderId: ORDER_ID,
        paymentId: PAYMENT_ID,
        signature: forged,
        keySecret: SECRET,
      }),
    ).toBe(false);
  });

  it("rejects when the orderId is tampered after signing", () => {
    const signature = sign(ORDER_ID, PAYMENT_ID, SECRET);
    expect(
      verifyPaymentSignatureWithKeys({
        orderId: "order_TAMPERED",
        paymentId: PAYMENT_ID,
        signature,
        keySecret: SECRET,
      }),
    ).toBe(false);
  });

  it("rejects when the paymentId is tampered after signing", () => {
    const signature = sign(ORDER_ID, PAYMENT_ID, SECRET);
    expect(
      verifyPaymentSignatureWithKeys({
        orderId: ORDER_ID,
        paymentId: "pay_TAMPERED",
        signature,
        keySecret: SECRET,
      }),
    ).toBe(false);
  });

  it("is order-sensitive: swapping order_id and payment_id fails", () => {
    // Guards against a concatenation bug — `${order}|${payment}` must not verify
    // against `${payment}|${order}`.
    const signature = sign(ORDER_ID, PAYMENT_ID, SECRET);
    expect(
      verifyPaymentSignatureWithKeys({
        orderId: PAYMENT_ID,
        paymentId: ORDER_ID,
        signature,
        keySecret: SECRET,
      }),
    ).toBe(false);
  });

  it("returns false for an empty secret without throwing", () => {
    const signature = sign(ORDER_ID, PAYMENT_ID, SECRET);
    expect(
      verifyPaymentSignatureWithKeys({
        orderId: ORDER_ID,
        paymentId: PAYMENT_ID,
        signature,
        keySecret: "",
      }),
    ).toBe(false);
  });

  it("rejects an empty or malformed signature without throwing", () => {
    for (const signature of ["", "deadbeef", "z".repeat(64)]) {
      expect(
        verifyPaymentSignatureWithKeys({
          orderId: ORDER_ID,
          paymentId: PAYMENT_ID,
          signature,
          keySecret: SECRET,
        }),
      ).toBe(false);
    }
  });

  it("handles a signature of a different length (timing-safe length guard)", () => {
    // safeEqualHex must short-circuit on length mismatch instead of throwing
    // (timingSafeEqual throws on unequal buffer lengths).
    const correct = sign(ORDER_ID, PAYMENT_ID, SECRET);
    expect(() =>
      verifyPaymentSignatureWithKeys({
        orderId: ORDER_ID,
        paymentId: PAYMENT_ID,
        signature: correct.slice(0, 32), // half-length hex
        keySecret: SECRET,
      }),
    ).not.toThrow();
    expect(
      verifyPaymentSignatureWithKeys({
        orderId: ORDER_ID,
        paymentId: PAYMENT_ID,
        signature: correct.slice(0, 32),
        keySecret: SECRET,
      }),
    ).toBe(false);
  });
});
