"use server";

import { headers } from "next/headers";
import {
  getPublishedCourseById,
  createBuyerPayment,
  applyCoupon,
  getEnrolment,
  isTenantSuspended,
} from "@invoxai/db";
import { getGatewayCredentials } from "../../../lib/gateway";
import { createOrderWithKeys } from "../../../lib/razorpay";
import { getSessionUser } from "../../../lib/auth";
import { couponErrorMessage } from "../../../lib/coupon-message";
import { resolveTenantByHost } from "../../../lib/resolve";

export type StartCourseResult =
  | { ok: false; error: string }
  | {
      ok: true;
      orderId: string;
      amountPaise: number;
      keyId: string;
      title: string;
    };

/**
 * Start a buyer checkout for a course (Courses / LMS slice 1). SECURITY: the
 * course id is the only client input; price/title/owning tenant are read from the
 * DB (server-trusted). The Razorpay order is created on the SELLER's gateway, so
 * funds settle seller-direct — InvoxAI never holds buyer money. On PAID the order
 * grants an Enrolment (markBuyerPaymentPaid). A coupon, if supplied, is applied
 * authoritatively here (never trusting any client discount).
 */
export async function startCourseCheckout(
  courseId: string,
  buyer: { email?: string; contact?: string },
  couponCode?: string,
): Promise<StartCourseResult> {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) return { ok: false, error: "This store is unavailable." };

  const course = await getPublishedCourseById(courseId);
  if (!course || course.tenantId !== tenant.id) {
    return { ok: false, error: "This course is unavailable." };
  }
  if (await isTenantSuspended(tenant.id)) {
    return { ok: false, error: "This store is temporarily unavailable." };
  }

  const user = await getSessionUser();

  // Access is granted by an Enrolment attributed by profileId (signed in) OR
  // email. A guest who pays with no email could never be matched to their
  // enrolment (profileId + email both null) — money taken, access impossible.
  // So require an email when not signed in.
  const buyerEmail = (buyer.email ?? user?.email ?? "").trim() || null;
  if (!user && !buyerEmail) {
    return { ok: false, error: "Enter your email so you can access the course after paying." };
  }

  // Don't let the same buyer pay for a course they already own — checked by
  // profileId AND email, so a GUEST re-purchase (by email) is blocked too, not
  // just the signed-in case. (NO_MATCH stands in for "no profile" so the email
  // branch still does the lookup.) A concurrent double-buy can still slip
  // through — accepted, like the stock/coupon over-redemption windows.
  const existing = await getEnrolment({
    tenantId: tenant.id,
    courseId: course.id,
    profileId: user?.id ?? "00000000-0000-0000-0000-000000000000",
    email: buyerEmail,
  });
  if (existing) return { ok: false, error: "You already have access to this course." };

  const creds = await getGatewayCredentials(tenant.id);
  if (!creds) {
    return { ok: false, error: "The seller hasn’t finished setting up payments yet." };
  }

  let amountPaise = course.pricePaise;
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
    receipt: `course_${course.id}`.slice(0, 40),
    notes: { courseId: course.id, tenantId: tenant.id },
  });

  await createBuyerPayment({
    razorpayOrderId: order.id,
    tenantId: tenant.id,
    courseId: course.id,
    itemTitle: course.title,
    amountPaise,
    couponId,
    couponCode: couponSnapshot,
    discountPaise,
    buyerProfileId: user?.id ?? null,
    buyerEmail,
    buyerContact: buyer.contact ?? null,
  });

  return { ok: true, orderId: order.id, amountPaise, keyId: creds.keyId, title: course.title };
}

export type PreviewCouponResult =
  | { ok: true; code: string; discountPaise: number }
  | { ok: false; error: string };

/** Read-only coupon preview for the course buy box (re-priced server-trusted). */
export async function previewCourseCoupon(
  courseId: string,
  code: string,
): Promise<PreviewCouponResult> {
  const trimmed = (code ?? "").trim();
  if (!trimmed) return { ok: false, error: "Enter a code." };
  const course = await getPublishedCourseById(courseId);
  if (!course) return { ok: false, error: "This course is unavailable." };
  const result = await applyCoupon(course.tenantId, trimmed, course.pricePaise);
  if (!result.ok) return { ok: false, error: couponErrorMessage(result) };
  return { ok: true, code: result.code, discountPaise: result.discountPaise };
}
