import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Razorpay helpers for the BUYER checkout, operating on a SELLER's own keys
 * (passed explicitly — never the platform env keys). Buyer money is created and
 * settled on the seller's account; InvoxAI never holds it (hard rule).
 */

const ORDERS_URL = "https://api.razorpay.com/v1/orders";

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

/** Create an order on the seller's gateway. Throws on non-2xx. */
export async function createOrderWithKeys(
  keyId: string,
  keySecret: string,
  input: { amountPaise: number; receipt: string; notes?: Record<string, string> },
): Promise<RazorpayOrder> {
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const res = await fetch(ORDERS_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: "INR",
      receipt: input.receipt,
      notes: input.notes ?? {},
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Razorpay order create failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as RazorpayOrder;
}

function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Verify the Checkout success signature using the SELLER's secret:
 * HMAC_SHA256(`${order_id}|${payment_id}`, sellerSecret). This is the
 * authoritative confirmation for buyer payments (synchronous verify model).
 */
export function verifyPaymentSignatureWithKeys(input: {
  orderId: string;
  paymentId: string;
  signature: string;
  keySecret: string;
}): boolean {
  if (!input.keySecret) return false;
  const expected = createHmac("sha256", input.keySecret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");
  return safeEqualHex(expected, input.signature);
}
