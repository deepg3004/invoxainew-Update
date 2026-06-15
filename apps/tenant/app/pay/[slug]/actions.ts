"use server";

import {
  getActivePaymentPageById,
  createBuyerPayment,
  getEnabledSellerUpi,
  createUpiSession,
  applyCoupon,
  isTenantSuspended,
  getActiveOtoForOrder,
  findOtoOrder,
  resolveOtoContext,
  type OtoOffer,
} from "@invoxai/db";
import { getGatewayCredentials } from "../../../lib/gateway";
import { createOrderWithKeys } from "../../../lib/razorpay";
import { getSessionUser } from "../../../lib/auth";
import { readUtmCookie } from "../../../lib/utm";
import { affiliateAttribution } from "../../../lib/affiliate";
import { couponErrorMessage } from "../../../lib/coupon-message";
import type { StartUpiSessionResult } from "../../../lib/upi";

export type StartBuyerResult =
  | { ok: false; error: string }
  | {
      ok: true;
      orderId: string;
      amountPaise: number;
      keyId: string;
      title: string;
    };

export type PreviewCouponResult =
  | { ok: true; code: string; discountPaise: number }
  | { ok: false; error: string };

/** Read-only coupon preview for the payment-page buy box (amount server-trusted). */
export async function previewPayCoupon(
  paymentPageId: string,
  code: string,
): Promise<PreviewCouponResult> {
  const trimmed = (code ?? "").trim();
  if (!trimmed) return { ok: false, error: "Enter a code." };
  const page = await getActivePaymentPageById(paymentPageId);
  if (!page) return { ok: false, error: "This payment page is unavailable." };
  const result = await applyCoupon(page.tenantId, trimmed, page.amountPaise);
  if (!result.ok) return { ok: false, error: couponErrorMessage(result) };
  return { ok: true, code: result.code, discountPaise: result.discountPaise };
}

/**
 * Re-price a payment page with an optional coupon (server-trusted). Shared by the
 * Razorpay + UPI start paths so both apply the discount identically.
 */
async function priceWithCoupon(
  tenantId: string,
  amountPaise: number,
  couponCode?: string,
  buyerEmail?: string | null,
):
  | Promise<
      | { ok: true; amountPaise: number; couponId: string | null; couponCode: string | null; discountPaise: number }
      | { ok: false; error: string }
    > {
  const code = (couponCode ?? "").trim();
  if (!code) return { ok: true, amountPaise, couponId: null, couponCode: null, discountPaise: 0 };
  const result = await applyCoupon(tenantId, code, amountPaise, { buyerEmail });
  if (!result.ok) return { ok: false, error: couponErrorMessage(result) };
  return {
    ok: true,
    amountPaise: amountPaise - result.discountPaise,
    couponId: result.couponId,
    couponCode: result.code,
    discountPaise: result.discountPaise,
  };
}

/**
 * Start a buyer checkout for a payment page. SECURITY: the page id is the only
 * client input; the amount and the owning tenant are read from the DB
 * (server-trusted). The Razorpay order is created on the SELLER's gateway, so
 * funds settle to the seller — InvoxAI never holds buyer money.
 */
export async function startBuyerCheckout(
  paymentPageId: string,
  buyer: { email?: string; contact?: string },
  couponCode?: string,
): Promise<StartBuyerResult> {
  const page = await getActivePaymentPageById(paymentPageId);
  if (!page) return { ok: false, error: "This payment page is unavailable." };

  // Suspended store can't take payments (Phase 3 admin).
  if (await isTenantSuspended(page.tenantId)) {
    return { ok: false, error: "This store is temporarily unavailable." };
  }

  const creds = await getGatewayCredentials(page.tenantId);
  if (!creds) {
    return { ok: false, error: "The seller hasn’t finished setting up payments yet." };
  }

  // Apply a coupon if supplied — authoritative, against the page amount.
  const priced = await priceWithCoupon(page.tenantId, page.amountPaise, couponCode, buyer.email ?? null);
  if (!priced.ok) return { ok: false, error: priced.error };

  const order = await createOrderWithKeys(creds.keyId, creds.keySecret, {
    amountPaise: priced.amountPaise,
    receipt: `pp_${page.id}`.slice(0, 40),
    notes: { paymentPageId: page.id, tenantId: page.tenantId },
  });

  // Guest checkout: attribute the order to the buyer's account only if they
  // happen to be signed in (C8). Email still captures guest orders for later.
  const user = await getSessionUser();

  await createBuyerPayment({
    razorpayOrderId: order.id,
    tenantId: page.tenantId,
    paymentPageId: page.id,
    itemTitle: page.title,
    amountPaise: priced.amountPaise,
    couponId: priced.couponId,
    couponCode: priced.couponCode,
    discountPaise: priced.discountPaise,
    buyerProfileId: user?.id ?? null,
    buyerEmail: buyer.email ?? user?.email ?? null,
    buyerContact: buyer.contact ?? null,
    utm: await readUtmCookie(),
    affiliate: await affiliateAttribution(page.tenantId, priced.amountPaise),
  });

  return {
    ok: true,
    orderId: order.id,
    amountPaise: priced.amountPaise,
    keyId: creds.keyId,
    title: page.title,
  };
}

/**
 * Start a manual-UPI payment session for a payment page (the buyer then pays the
 * unique amount + submits their reference via the shared submitUpiRef). Amount +
 * tenant are server-trusted from the page. Nothing is paid / no commission until
 * the reference is submitted and the order auto-confirms (or the seller confirms).
 */
export async function startPayUpiSession(
  paymentPageId: string,
  buyer: { email?: string; contact?: string },
  couponCode?: string,
): Promise<StartUpiSessionResult> {
  const page = await getActivePaymentPageById(paymentPageId);
  if (!page) return { ok: false, error: "This payment page is unavailable." };
  if (await isTenantSuspended(page.tenantId)) {
    return { ok: false, error: "This store is temporarily unavailable." };
  }
  const upi = await getEnabledSellerUpi(page.tenantId);
  if (!upi) return { ok: false, error: "UPI isn’t available for this seller." };

  const priced = await priceWithCoupon(page.tenantId, page.amountPaise, couponCode, buyer.email ?? null);
  if (!priced.ok) return { ok: false, error: priced.error };

  const user = await getSessionUser();
  const session = await createUpiSession({
    tenantId: page.tenantId,
    amountPaise: priced.amountPaise,
    ttlMinutes: upi.sessionTtlMinutes,
    paymentPageId: page.id,
    itemTitle: page.title,
    couponId: priced.couponId,
    couponCode: priced.couponCode,
    discountPaise: priced.discountPaise,
    buyerProfileId: user?.id ?? null,
    buyerEmail: buyer.email ?? user?.email ?? null,
    buyerContact: buyer.contact ?? null,
    utm: await readUtmCookie(),
    affiliate: await affiliateAttribution(page.tenantId, priced.amountPaise),
  });
  if (!session.ok) {
    return { ok: false, error: "Too many payments in progress right now — please try again in a moment." };
  }
  return {
    ok: true,
    buyerPaymentId: session.id,
    payAmountPaise: session.payAmountPaise,
    expiresAt: session.expiresAt.toISOString(),
  };
}

// ── Growth G1.1: post-purchase one-time offer (OTO) ──────────────────────────

/**
 * The OTO to show on a just-paid order's success screen, or null. Read-only;
 * resolves the active offer for the PAID parent order (tenant-scoped via the order).
 */
export async function getOtoForOrder(parentRazorpayOrderId: string): Promise<OtoOffer | null> {
  if (!parentRazorpayOrderId) return null;
  return getActiveOtoForOrder(parentRazorpayOrderId);
}

export type StartOtoResult =
  | { ok: false; error: string; alreadyBought?: boolean }
  | { ok: true; orderId: string; amountPaise: number; keyId: string; title: string };

/**
 * Start (or re-open) the one-click OTO checkout on the SELLER's gateway. The amount
 * is recomputed server-side from the offer product + the upsell's discount — the
 * client supplies only ids. Idempotent: at most one OTO order per (parent order,
 * upsell), so a refreshed success page or a double-click can't create a second
 * charge. The resulting order is a normal product BuyerPayment, so /api/pay/verify
 * and the markBuyerPaymentPaid claim (commission, stock, grants) apply unchanged.
 */
export async function startOtoCheckout(
  upsellId: string,
  parentRazorpayOrderId: string,
): Promise<StartOtoResult> {
  const ctx = await resolveOtoContext(parentRazorpayOrderId, upsellId);
  if (!ctx) return { ok: false, error: "This offer is no longer available." };

  if (await isTenantSuspended(ctx.parent.tenantId)) {
    return { ok: false, error: "This store is temporarily unavailable." };
  }

  const creds = await getGatewayCredentials(ctx.parent.tenantId);
  if (!creds) {
    return { ok: false, error: "The seller hasn’t finished setting up payments yet." };
  }

  // Idempotency: reuse any existing OTO order for this parent×upsell.
  const existing = await findOtoOrder(ctx.parent.id, upsellId);
  if (existing) {
    if (existing.status === "PAID") {
      return { ok: false, error: "You’ve already added this.", alreadyBought: true };
    }
    if (existing.status === "CREATED") {
      return {
        ok: true,
        orderId: existing.razorpayOrderId,
        amountPaise: existing.amountPaise,
        keyId: creds.keyId,
        title: ctx.title,
      };
    }
    // FAILED/EXPIRED/etc → fall through and create a fresh order.
  }

  const order = await createOrderWithKeys(creds.keyId, creds.keySecret, {
    amountPaise: ctx.pricePaise,
    receipt: `oto_${upsellId}`.slice(0, 40),
    notes: { upsellId, parentPaymentId: ctx.parent.id, tenantId: ctx.parent.tenantId },
  });

  try {
    await createBuyerPayment({
      razorpayOrderId: order.id,
      tenantId: ctx.parent.tenantId,
      productId: ctx.offerProductId,
      itemTitle: ctx.title,
      amountPaise: ctx.pricePaise,
      buyerProfileId: ctx.parent.buyerProfileId,
      buyerEmail: ctx.parent.buyerEmail,
      buyerContact: ctx.parent.buyerContact,
      parentPaymentId: ctx.parent.id,
      upsellId,
      affiliate: await affiliateAttribution(ctx.parent.tenantId, ctx.pricePaise),
    });
  } catch {
    // Lost the race on the (parent, upsell) unique → reuse the winner's order.
    const dup = await findOtoOrder(ctx.parent.id, upsellId);
    if (dup && dup.status === "CREATED") {
      return {
        ok: true,
        orderId: dup.razorpayOrderId,
        amountPaise: dup.amountPaise,
        keyId: creds.keyId,
        title: ctx.title,
      };
    }
    return { ok: false, error: "Could not start the offer. Please try again." };
  }

  return {
    ok: true,
    orderId: order.id,
    amountPaise: ctx.pricePaise,
    keyId: creds.keyId,
    title: ctx.title,
  };
}
