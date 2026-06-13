"use server";

import { headers } from "next/headers";
import {
  getPublishedCommunityById,
  createBuyerPayment,
  applyCoupon,
  getMembership,
  joinFreeCommunity,
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
import type { StartUpiSessionResult } from "../../../lib/upi";

const NO_PROFILE = "00000000-0000-0000-0000-000000000000";

export type StartCommunityResult =
  | { ok: false; error: string }
  | { ok: true; orderId: string; amountPaise: number; keyId: string; title: string };

/**
 * Start a buyer checkout for a PAID community. Same proven rail as a course: the
 * community id is the only client input; price/title/tenant are server-trusted; the
 * Razorpay order is created on the SELLER's gateway. On PAID the order grants a
 * CommunityMembership (markBuyerPaymentPaid). Coupon applied authoritatively here.
 */
export async function startCommunityCheckout(
  communityId: string,
  buyer: { email?: string; contact?: string },
  couponCode?: string,
): Promise<StartCommunityResult> {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) return { ok: false, error: "This store is unavailable." };

  const community = await getPublishedCommunityById(communityId);
  if (!community || community.tenantId !== tenant.id) {
    return { ok: false, error: "This community is unavailable." };
  }
  if (community.pricePaise <= 0) {
    return { ok: false, error: "This community is free — use Join." };
  }
  if (await isTenantSuspended(tenant.id)) {
    return { ok: false, error: "This store is temporarily unavailable." };
  }

  const user = await getSessionUser();
  // Membership is attributed by profileId or purchase email — a guest paying with
  // no email could never be matched, so require an email when not signed in.
  const buyerEmail = (buyer.email ?? user?.email ?? "").trim() || null;
  if (!user && !buyerEmail) {
    return { ok: false, error: "Enter your email so you can access the community after paying." };
  }

  const existing = await getMembership({
    tenantId: tenant.id,
    communityId: community.id,
    profileId: user?.id ?? NO_PROFILE,
    email: buyerEmail,
  });
  if (existing) return { ok: false, error: "You’re already a member of this community." };

  const creds = await getGatewayCredentials(tenant.id);
  if (!creds) return { ok: false, error: "The seller hasn’t finished setting up payments yet." };

  let amountPaise = community.pricePaise;
  const code = (couponCode ?? "").trim();
  let couponId: string | null = null;
  let couponSnapshot: string | null = null;
  let discountPaise = 0;
  if (code) {
    const result = await applyCoupon(tenant.id, code, amountPaise);
    if (!result.ok) return { ok: false, error: couponErrorMessage(result) };
    couponId = result.couponId;
    couponSnapshot = result.code;
    discountPaise = result.discountPaise;
    amountPaise -= discountPaise;
  }

  const order = await createOrderWithKeys(creds.keyId, creds.keySecret, {
    amountPaise,
    receipt: `comm_${community.id}`.slice(0, 40),
    notes: { communityId: community.id, tenantId: tenant.id },
  });

  await createBuyerPayment({
    razorpayOrderId: order.id,
    tenantId: tenant.id,
    communityId: community.id,
    itemTitle: community.title,
    amountPaise,
    couponId,
    couponCode: couponSnapshot,
    discountPaise,
    buyerProfileId: user?.id ?? null,
    buyerEmail,
    buyerContact: buyer.contact ?? null,
    utm: await readUtmCookie(),
  });

  return { ok: true, orderId: order.id, amountPaise, keyId: creds.keyId, title: community.title };
}

/** Manual-UPI session for a PAID community — mirrors startCommunityCheckout. */
export async function startCommunityUpiSession(
  communityId: string,
  buyer: { email?: string; contact?: string },
  couponCode?: string,
): Promise<StartUpiSessionResult> {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) return { ok: false, error: "This store is unavailable." };

  const community = await getPublishedCommunityById(communityId);
  if (!community || community.tenantId !== tenant.id) {
    return { ok: false, error: "This community is unavailable." };
  }
  if (community.pricePaise <= 0) return { ok: false, error: "This community is free — use Join." };
  if (await isTenantSuspended(tenant.id)) {
    return { ok: false, error: "This store is temporarily unavailable." };
  }

  const user = await getSessionUser();
  const buyerEmail = (buyer.email ?? user?.email ?? "").trim() || null;
  if (!user && !buyerEmail) {
    return { ok: false, error: "Enter your email so you can access the community after paying." };
  }
  const existing = await getMembership({
    tenantId: tenant.id,
    communityId: community.id,
    profileId: user?.id ?? NO_PROFILE,
    email: buyerEmail,
  });
  if (existing) return { ok: false, error: "You’re already a member of this community." };

  const upi = await getEnabledSellerUpi(tenant.id);
  if (!upi) return { ok: false, error: "UPI isn’t available for this seller." };

  let amountPaise = community.pricePaise;
  const code = (couponCode ?? "").trim();
  let couponId: string | null = null;
  let couponSnapshot: string | null = null;
  let discountPaise = 0;
  if (code) {
    const result = await applyCoupon(tenant.id, code, amountPaise);
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
    communityId: community.id,
    itemTitle: community.title,
    couponId,
    couponCode: couponSnapshot,
    discountPaise,
    buyerProfileId: user?.id ?? null,
    buyerEmail,
    buyerContact: buyer.contact ?? null,
    utm: await readUtmCookie(),
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

export type JoinFreeActionResult = { ok: true; slug: string } | { ok: false; error: string; needLogin?: boolean };

/**
 * Join a FREE community. Requires sign-in (membership is attributed by profileId).
 * Idempotent: an existing member just succeeds. The community price is re-read
 * server-trusted inside joinFreeCommunity, so a paid community can't be joined free.
 */
export async function joinFreeCommunityAction(communityId: string): Promise<JoinFreeActionResult> {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) return { ok: false, error: "This store is unavailable." };

  const community = await getPublishedCommunityById(communityId);
  if (!community || community.tenantId !== tenant.id) {
    return { ok: false, error: "This community is unavailable." };
  }

  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in to join this community.", needLogin: true };

  // Already a member? Succeed idempotently.
  const existing = await getMembership({
    tenantId: tenant.id,
    communityId: community.id,
    profileId: user.id,
    email: user.email ?? null,
  });
  if (existing) return { ok: true, slug: community.slug };

  const res = await joinFreeCommunity({
    tenantId: tenant.id,
    communityId: community.id,
    profileId: user.id,
    email: user.email ?? null,
  });
  if (!res.ok) {
    return { ok: false, error: res.reason === "not_free" ? "This community requires payment." : "This community is unavailable." };
  }
  return { ok: true, slug: community.slug };
}

export type PreviewCouponResult =
  | { ok: true; code: string; discountPaise: number }
  | { ok: false; error: string };

export async function previewCommunityCoupon(
  communityId: string,
  code: string,
): Promise<PreviewCouponResult> {
  const trimmed = (code ?? "").trim();
  if (!trimmed) return { ok: false, error: "Enter a code." };
  const community = await getPublishedCommunityById(communityId);
  if (!community) return { ok: false, error: "This community is unavailable." };
  const result = await applyCoupon(community.tenantId, trimmed, community.pricePaise);
  if (!result.ok) return { ok: false, error: couponErrorMessage(result) };
  return { ok: true, code: result.code, discountPaise: result.discountPaise };
}
