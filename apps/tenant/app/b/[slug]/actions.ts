"use server";

import { headers } from "next/headers";
import {
  getPublishedBookingTypeById,
  getOpenSlot,
  createBuyerPayment,
  applyCoupon,
  isTenantSuspended,
  getEnabledSellerUpi,
  createUpiSession,
} from "@invoxai/db";
import { getGatewayCredentials } from "../../../lib/gateway";
import { createOrderWithKeys } from "../../../lib/razorpay";
import { getSessionUser } from "../../../lib/auth";
import { couponErrorMessage } from "../../../lib/coupon-message";
import { resolveTenantByHost } from "../../../lib/resolve";
import { readUtmCookie } from "../../../lib/utm";
import { affiliateAttribution } from "../../../lib/affiliate";
import type { StartUpiSessionResult } from "../../../lib/upi";

export type StartBookingResult =
  | { ok: false; error: string }
  | { ok: true; orderId: string; amountPaise: number; keyId: string; title: string };

/**
 * Start a booking checkout for a specific OPEN slot. Same rail as a workshop; the
 * type id + slot id are the only client inputs, price/title/tenant are server-
 * trusted, and the slot is re-checked OPEN here. On PAID the order atomically claims
 * the slot + grants a Booking (markBuyerPaymentPaid) — if the slot was taken in a
 * race, a slot-less booking is still recorded so the payment is never lost.
 */
export async function startBookingCheckout(
  bookingTypeId: string,
  slotId: string,
  buyer: { email?: string; contact?: string },
  couponCode?: string,
): Promise<StartBookingResult> {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) return { ok: false, error: "This store is unavailable." };

  const type = await getPublishedBookingTypeById(bookingTypeId);
  if (!type || type.tenantId !== tenant.id) return { ok: false, error: "This booking is unavailable." };
  if (type.pricePaise <= 0) return { ok: false, error: "This booking isn’t purchasable." };
  if (await isTenantSuspended(tenant.id)) return { ok: false, error: "This store is temporarily unavailable." };

  const slot = await getOpenSlot(type.id, slotId);
  if (!slot) return { ok: false, error: "That time is no longer available — pick another slot." };

  const user = await getSessionUser();
  const buyerEmail = (buyer.email ?? user?.email ?? "").trim() || null;
  if (!user && !buyerEmail) {
    return { ok: false, error: "Enter your email so you can access the meeting after paying." };
  }

  const creds = await getGatewayCredentials(tenant.id);
  if (!creds) return { ok: false, error: "The seller hasn’t finished setting up payments yet." };

  let amountPaise = type.pricePaise;
  const code = (couponCode ?? "").trim();
  let couponId: string | null = null;
  let couponSnapshot: string | null = null;
  let discountPaise = 0;
  if (code) {
    const result = await applyCoupon(tenant.id, code, amountPaise, { buyerEmail });
    if (!result.ok) return { ok: false, error: couponErrorMessage(result) };
    couponId = result.couponId;
    couponSnapshot = result.code;
    discountPaise = result.discountPaise;
    amountPaise -= discountPaise;
  }

  const order = await createOrderWithKeys(creds.keyId, creds.keySecret, {
    amountPaise,
    receipt: `book_${slot.id}`.slice(0, 40),
    notes: { bookingSlotId: slot.id, tenantId: tenant.id },
  });

  await createBuyerPayment({
    razorpayOrderId: order.id,
    tenantId: tenant.id,
    bookingSlotId: slot.id,
    itemTitle: type.title,
    amountPaise,
    couponId,
    couponCode: couponSnapshot,
    discountPaise,
    buyerProfileId: user?.id ?? null,
    buyerEmail,
    buyerContact: buyer.contact ?? null,
    utm: await readUtmCookie(),
    affiliate: await affiliateAttribution(tenant.id, amountPaise),
  });

  return { ok: true, orderId: order.id, amountPaise, keyId: creds.keyId, title: type.title };
}

/** Manual-UPI session for a booking slot — mirrors startBookingCheckout. */
export async function startBookingUpiSession(
  bookingTypeId: string,
  slotId: string,
  buyer: { email?: string; contact?: string },
  couponCode?: string,
): Promise<StartUpiSessionResult> {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) return { ok: false, error: "This store is unavailable." };

  const type = await getPublishedBookingTypeById(bookingTypeId);
  if (!type || type.tenantId !== tenant.id) return { ok: false, error: "This booking is unavailable." };
  if (type.pricePaise <= 0) return { ok: false, error: "This booking isn’t purchasable." };
  if (await isTenantSuspended(tenant.id)) return { ok: false, error: "This store is temporarily unavailable." };

  const slot = await getOpenSlot(type.id, slotId);
  if (!slot) return { ok: false, error: "That time is no longer available — pick another slot." };

  const user = await getSessionUser();
  const buyerEmail = (buyer.email ?? user?.email ?? "").trim() || null;
  if (!user && !buyerEmail) {
    return { ok: false, error: "Enter your email so you can access the meeting after paying." };
  }

  const upi = await getEnabledSellerUpi(tenant.id);
  if (!upi) return { ok: false, error: "UPI isn’t available for this seller." };

  let amountPaise = type.pricePaise;
  const code = (couponCode ?? "").trim();
  let couponId: string | null = null;
  let couponSnapshot: string | null = null;
  let discountPaise = 0;
  if (code) {
    const result = await applyCoupon(tenant.id, code, amountPaise, { buyerEmail });
    if (!result.ok) return { ok: false, error: couponErrorMessage(result) };
    couponId = result.couponId;
    couponSnapshot = result.code;
    discountPaise = result.discountPaise;
    amountPaise -= discountPaise;
  }

  const session = await createUpiSession({
    tenantId: tenant.id,
    amountPaise,
    ttlMinutes: upi.sessionTtlMinutes,
    bookingSlotId: slot.id,
    itemTitle: type.title,
    couponId,
    couponCode: couponSnapshot,
    discountPaise,
    buyerProfileId: user?.id ?? null,
    buyerEmail,
    buyerContact: buyer.contact ?? null,
    utm: await readUtmCookie(),
    affiliate: await affiliateAttribution(tenant.id, amountPaise),
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

export type PreviewCouponResult =
  | { ok: true; code: string; discountPaise: number }
  | { ok: false; error: string };

export async function previewBookingCoupon(
  bookingTypeId: string,
  code: string,
): Promise<PreviewCouponResult> {
  const trimmed = (code ?? "").trim();
  if (!trimmed) return { ok: false, error: "Enter a code." };
  const type = await getPublishedBookingTypeById(bookingTypeId);
  if (!type) return { ok: false, error: "This booking is unavailable." };
  const result = await applyCoupon(type.tenantId, trimmed, type.pricePaise);
  if (!result.ok) return { ok: false, error: couponErrorMessage(result) };
  return { ok: true, code: result.code, discountPaise: result.discountPaise };
}
