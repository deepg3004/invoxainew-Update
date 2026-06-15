"use server";

import { headers } from "next/headers";
import {
  getPublishedWorkshopById,
  createBuyerPayment,
  applyCoupon,
  getWorkshopRegistration,
  joinFreeWorkshop,
  countWorkshopRegistrations,
  isSoldOut,
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

const NO_PROFILE = "00000000-0000-0000-0000-000000000000";

export type StartWorkshopResult =
  | { ok: false; error: string }
  | { ok: true; orderId: string; amountPaise: number; keyId: string; title: string };

/**
 * Start a buyer checkout for a PAID workshop. Same proven rail as a community: the
 * workshop id is the only client input; price/title/tenant/seat cap are server-
 * trusted; the Razorpay order is created on the SELLER's gateway. On PAID the order
 * grants a WorkshopRegistration (markBuyerPaymentPaid). Coupon applied here.
 *
 * Seats are a SOFT cap (best-effort count check) — a rare race can admit one extra,
 * acceptable for a live session and never corrupting the money path.
 */
export async function startWorkshopCheckout(
  workshopId: string,
  buyer: { email?: string; contact?: string },
  couponCode?: string,
): Promise<StartWorkshopResult> {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) return { ok: false, error: "This store is unavailable." };

  const workshop = await getPublishedWorkshopById(workshopId);
  if (!workshop || workshop.tenantId !== tenant.id) {
    return { ok: false, error: "This workshop is unavailable." };
  }
  if (workshop.pricePaise <= 0) {
    return { ok: false, error: "This workshop is free — use Register." };
  }
  if (await isTenantSuspended(tenant.id)) {
    return { ok: false, error: "This store is temporarily unavailable." };
  }

  const user = await getSessionUser();
  const buyerEmail = (buyer.email ?? user?.email ?? "").trim() || null;
  if (!user && !buyerEmail) {
    return { ok: false, error: "Enter your email so you can access the workshop after paying." };
  }

  const existing = await getWorkshopRegistration({
    tenantId: tenant.id,
    workshopId: workshop.id,
    profileId: user?.id ?? NO_PROFILE,
    email: buyerEmail,
  });
  if (existing) return { ok: false, error: "You’re already registered for this workshop." };

  // Soft seat cap — re-counted server-side at checkout time.
  if (workshop.maxSeats != null) {
    const taken = await countWorkshopRegistrations(workshop.id);
    if (isSoldOut(workshop.maxSeats, taken)) {
      return { ok: false, error: "This workshop is sold out." };
    }
  }

  const creds = await getGatewayCredentials(tenant.id);
  if (!creds) return { ok: false, error: "The seller hasn’t finished setting up payments yet." };

  let amountPaise = workshop.pricePaise;
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
    receipt: `wshop_${workshop.id}`.slice(0, 40),
    notes: { workshopId: workshop.id, tenantId: tenant.id },
  });

  await createBuyerPayment({
    razorpayOrderId: order.id,
    tenantId: tenant.id,
    workshopId: workshop.id,
    itemTitle: workshop.title,
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

  return { ok: true, orderId: order.id, amountPaise, keyId: creds.keyId, title: workshop.title };
}

/** Manual-UPI session for a PAID workshop — mirrors startWorkshopCheckout. */
export async function startWorkshopUpiSession(
  workshopId: string,
  buyer: { email?: string; contact?: string },
  couponCode?: string,
): Promise<StartUpiSessionResult> {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) return { ok: false, error: "This store is unavailable." };

  const workshop = await getPublishedWorkshopById(workshopId);
  if (!workshop || workshop.tenantId !== tenant.id) {
    return { ok: false, error: "This workshop is unavailable." };
  }
  if (workshop.pricePaise <= 0) return { ok: false, error: "This workshop is free — use Register." };
  if (await isTenantSuspended(tenant.id)) {
    return { ok: false, error: "This store is temporarily unavailable." };
  }

  const user = await getSessionUser();
  const buyerEmail = (buyer.email ?? user?.email ?? "").trim() || null;
  if (!user && !buyerEmail) {
    return { ok: false, error: "Enter your email so you can access the workshop after paying." };
  }
  const existing = await getWorkshopRegistration({
    tenantId: tenant.id,
    workshopId: workshop.id,
    profileId: user?.id ?? NO_PROFILE,
    email: buyerEmail,
  });
  if (existing) return { ok: false, error: "You’re already registered for this workshop." };

  if (workshop.maxSeats != null) {
    const taken = await countWorkshopRegistrations(workshop.id);
    if (isSoldOut(workshop.maxSeats, taken)) return { ok: false, error: "This workshop is sold out." };
  }

  const upi = await getEnabledSellerUpi(tenant.id);
  if (!upi) return { ok: false, error: "UPI isn’t available for this seller." };

  let amountPaise = workshop.pricePaise;
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
    workshopId: workshop.id,
    itemTitle: workshop.title,
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

export type JoinFreeWorkshopActionResult =
  | { ok: true; slug: string }
  | { ok: false; error: string; needLogin?: boolean };

/** Register for a FREE workshop. Requires sign-in (attributed by profileId). */
export async function joinFreeWorkshopAction(workshopId: string): Promise<JoinFreeWorkshopActionResult> {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) return { ok: false, error: "This store is unavailable." };

  const workshop = await getPublishedWorkshopById(workshopId);
  if (!workshop || workshop.tenantId !== tenant.id) {
    return { ok: false, error: "This workshop is unavailable." };
  }

  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in to register for this workshop.", needLogin: true };

  const existing = await getWorkshopRegistration({
    tenantId: tenant.id,
    workshopId: workshop.id,
    profileId: user.id,
    email: user.email ?? null,
  });
  if (existing) return { ok: true, slug: workshop.slug };

  const res = await joinFreeWorkshop({
    tenantId: tenant.id,
    workshopId: workshop.id,
    profileId: user.id,
    email: user.email ?? null,
  });
  if (!res.ok) {
    return {
      ok: false,
      error: res.reason === "not_free" ? "This workshop requires payment." : "This workshop is unavailable.",
    };
  }
  return { ok: true, slug: workshop.slug };
}

export type PreviewCouponResult =
  | { ok: true; code: string; discountPaise: number }
  | { ok: false; error: string };

export async function previewWorkshopCoupon(
  workshopId: string,
  code: string,
): Promise<PreviewCouponResult> {
  const trimmed = (code ?? "").trim();
  if (!trimmed) return { ok: false, error: "Enter a code." };
  const workshop = await getPublishedWorkshopById(workshopId);
  if (!workshop) return { ok: false, error: "This workshop is unavailable." };
  const result = await applyCoupon(workshop.tenantId, trimmed, workshop.pricePaise);
  if (!result.ok) return { ok: false, error: couponErrorMessage(result) };
  return { ok: true, code: result.code, discountPaise: result.discountPaise };
}
