import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@invoxai/config";

/**
 * Minimal server-only Razorpay helper for the PLATFORM gateway (InvoxAI's own
 * account — seller→InvoxAI fees only). No SDK: a couple of REST calls + HMAC
 * checks. The secret and webhook secret never leave the server.
 */

const ORDERS_URL = "https://api.razorpay.com/v1/orders";

/** True only when the platform gateway is fully configured. */
export function razorpayConfigured(): boolean {
  const env = serverEnv();
  return Boolean(
    env.NEXT_PUBLIC_RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET,
  );
}

function basicAuthHeader(): string {
  const env = serverEnv();
  const token = Buffer.from(
    `${env.NEXT_PUBLIC_RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`,
  ).toString("base64");
  return `Basic ${token}`;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

/**
 * Create a Razorpay order for `amountPaise` (INR). `receipt` is our own
 * reference; `notes` are echoed back on webhooks. Throws on a non-2xx so the
 * caller fails the checkout rather than handing the client a bad order.
 */
export async function createRazorpayOrder(input: {
  amountPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  const res = await fetch(ORDERS_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
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

export interface RazorpayRefund {
  id: string;
  amount: number;
  status: string;
}

/**
 * Issue a refund on the SELLER's gateway (Phase 1) for `amountPaise` of a
 * captured payment. Uses the seller's own keys. Razorpay itself rejects a refund
 * that exceeds the remaining refundable amount, so it can't be over-refunded.
 * Throws on a non-2xx so the caller doesn't record a refund that didn't happen.
 */
export async function refundPayment(input: {
  keyId: string;
  keySecret: string;
  paymentId: string;
  amountPaise: number;
}): Promise<RazorpayRefund> {
  const auth = Buffer.from(`${input.keyId}:${input.keySecret}`).toString("base64");
  const res = await fetch(
    `https://api.razorpay.com/v1/payments/${input.paymentId}/refunds`,
    {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: input.amountPaise }),
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Razorpay refund failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as RazorpayRefund;
}

/**
 * Validate an ARBITRARY Razorpay key id + secret (a seller's own keys, C6) by
 * making a cheap authenticated read against Razorpay. 200 → valid; 401 → bad
 * credentials. Unlike createRazorpayOrder (which uses InvoxAI's platform keys
 * from env), this takes the caller-supplied keys explicitly and never persists
 * them.
 */
export async function validateRazorpayCredentials(
  keyId: string,
  keySecret: string,
): Promise<{ ok: true } | { ok: false; reason: "invalid" | "error" }> {
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  try {
    const res = await fetch("https://api.razorpay.com/v1/payments?count=1", {
      method: "GET",
      headers: { Authorization: `Basic ${auth}` },
    });
    if (res.ok) return { ok: true };
    if (res.status === 401) return { ok: false, reason: "invalid" };
    return { ok: false, reason: "error" };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/** Constant-time compare of two hex digests (avoids timing leaks). */
function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Verify the signature Razorpay Checkout returns on success. Per Razorpay, the
 * signature is HMAC_SHA256(`${order_id}|${payment_id}`, key_secret).
 */
export function verifyPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const env = serverEnv();
  if (!env.RAZORPAY_KEY_SECRET) return false;
  const expected = createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");
  return safeEqualHex(expected, input.signature);
}

/**
 * Verify a webhook delivery. Razorpay signs the RAW request body with the
 * webhook secret: HMAC_SHA256(rawBody, webhook_secret), compared to the
 * `X-Razorpay-Signature` header. The raw (unparsed) body is essential — parsing
 * and re-stringifying would change bytes and break the check.
 */
export function verifyWebhookSignature(input: {
  rawBody: string;
  signature: string | null;
}): boolean {
  const env = serverEnv();
  if (!env.RAZORPAY_WEBHOOK_SECRET || !input.signature) return false;
  const expected = createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
    .update(input.rawBody)
    .digest("hex");
  return safeEqualHex(expected, input.signature);
}
