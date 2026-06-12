import { Prisma, type DiscountType } from "@prisma/client";
import { prisma } from "./client";

/**
 * Store slice 3 — coupons / discount codes.
 *
 * MONEY MODEL (hard rule): a coupon carries NO buyer money. It only reduces the
 * seller's sale total before the buyer pays on the SELLER's own gateway, which
 * in turn reduces InvoxAI's commission (commission is computed off the order's
 * post-discount `amountPaise` in markBuyerPaymentPaid — see payments.ts). The
 * discount is ALWAYS recomputed server-side here at checkout; the client's
 * claimed discount is never trusted.
 *
 * Tenant isolation: every read/write is scoped by tenantId. `code` is stored
 * UPPERCASE and is unique per tenant.
 *
 * Redemption counting is NOT done here — it happens once on the PAID claim in
 * markBuyerPaymentPaid (claim-winner only, so a replayed webhook can't
 * double-count). applyCoupon only validates against the current count.
 */

// The minimum chargeable order total (paise). Razorpay can't create a ₹0 order,
// so a discount is clamped to always leave at least this much to pay.
const MIN_CHARGE_PAISE = 100; // ₹1

export interface CouponInput {
  code: string;
  type: DiscountType;
  value: number; // PERCENT → bps (1000 = 10%); FLAT → paise
  minSubtotalPaise?: number | null;
  maxRedemptions?: number | null;
  startsAt?: Date | null;
  expiresAt?: Date | null;
  isActive?: boolean;
}

export type CreateCouponResult =
  | { ok: true; id: string }
  | { ok: false; reason: "code_taken" };

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export async function createCoupon(
  tenantId: string,
  input: CouponInput,
): Promise<CreateCouponResult> {
  try {
    const coupon = await prisma.coupon.create({
      data: {
        tenantId,
        code: normalizeCode(input.code),
        type: input.type,
        value: input.value,
        minSubtotalPaise: input.minSubtotalPaise ?? null,
        maxRedemptions: input.maxRedemptions ?? null,
        startsAt: input.startsAt ?? null,
        expiresAt: input.expiresAt ?? null,
        isActive: input.isActive ?? true,
      },
      select: { id: true },
    });
    return { ok: true, id: coupon.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, reason: "code_taken" };
    }
    throw e;
  }
}

/** A seller's coupons, newest first. Scoped by tenantId. */
export function listCoupons(tenantId: string) {
  return prisma.coupon.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });
}

/** A coupon owned by this tenant (seller scope). */
export function getCouponById(tenantId: string, id: string) {
  return prisma.coupon.findFirst({ where: { id, tenantId } });
}

/** Edit a coupon's terms (seller-scoped). The code itself is immutable here to
 *  keep it stable for buyers who already have it; sellers deactivate + recreate
 *  to change a code. Returns the updateMany batch result (count 0 = not owned). */
export function updateCoupon(
  tenantId: string,
  id: string,
  data: {
    type: DiscountType;
    value: number;
    minSubtotalPaise?: number | null;
    maxRedemptions?: number | null;
    startsAt?: Date | null;
    expiresAt?: Date | null;
  },
) {
  return prisma.coupon.updateMany({
    where: { id, tenantId },
    data: {
      type: data.type,
      value: data.value,
      minSubtotalPaise: data.minSubtotalPaise ?? null,
      maxRedemptions: data.maxRedemptions ?? null,
      startsAt: data.startsAt ?? null,
      expiresAt: data.expiresAt ?? null,
    },
  });
}

export function setCouponActive(tenantId: string, id: string, isActive: boolean) {
  return prisma.coupon.updateMany({
    where: { id, tenantId },
    data: { isActive },
  });
}

/** Delete a coupon (seller-scoped). Safe: any orders that used it keep their
 *  `couponCode`/`discountPaise` snapshot; the FK nulls out via SetNull. */
export function deleteCoupon(tenantId: string, id: string) {
  return prisma.coupon.deleteMany({ where: { id, tenantId } });
}

export type ApplyCouponResult =
  | { ok: true; couponId: string; code: string; discountPaise: number }
  | {
      ok: false;
      reason:
        | "not_found"
        | "inactive"
        | "not_started"
        | "expired"
        | "fully_redeemed"
        | "min_subtotal";
      minSubtotalPaise?: number;
    };

/**
 * Validate a code against a server-trusted `subtotalPaise` and compute the
 * discount — the single source of truth for what a coupon is worth. Called both
 * for the cart preview and (authoritatively) inside the checkout start actions.
 *
 * The discount is clamped so the order always leaves at least MIN_CHARGE_PAISE
 * to pay (Razorpay can't take a ₹0 order). Never returns a negative or
 * order-exceeding discount.
 */
export async function applyCoupon(
  tenantId: string,
  code: string,
  subtotalPaise: number,
): Promise<ApplyCouponResult> {
  const coupon = await prisma.coupon.findUnique({
    where: { tenantId_code: { tenantId, code: normalizeCode(code) } },
  });
  if (!coupon) return { ok: false, reason: "not_found" };
  if (!coupon.isActive) return { ok: false, reason: "inactive" };

  const now = new Date();
  if (coupon.startsAt && now < coupon.startsAt) {
    return { ok: false, reason: "not_started" };
  }
  if (coupon.expiresAt && now > coupon.expiresAt) {
    return { ok: false, reason: "expired" };
  }
  if (
    coupon.maxRedemptions !== null &&
    coupon.redeemedCount >= coupon.maxRedemptions
  ) {
    return { ok: false, reason: "fully_redeemed" };
  }
  if (
    coupon.minSubtotalPaise !== null &&
    subtotalPaise < coupon.minSubtotalPaise
  ) {
    return {
      ok: false,
      reason: "min_subtotal",
      minSubtotalPaise: coupon.minSubtotalPaise,
    };
  }

  const raw =
    coupon.type === "PERCENT"
      ? Math.floor((subtotalPaise * coupon.value) / 10000)
      : coupon.value;
  // Clamp into [0, subtotal - MIN_CHARGE_PAISE] so the order is never free/negative.
  const maxDiscount = Math.max(0, subtotalPaise - MIN_CHARGE_PAISE);
  const discountPaise = Math.max(0, Math.min(raw, maxDiscount));

  // If the clamp left nothing (cart at/under the ₹1 floor), the coupon does
  // nothing here — don't "apply" it (which would attach + burn a limited
  // redemption for zero benefit).
  if (discountPaise <= 0) {
    return {
      ok: false,
      reason: "min_subtotal",
      minSubtotalPaise: coupon.minSubtotalPaise ?? undefined,
    };
  }

  return { ok: true, couponId: coupon.id, code: coupon.code, discountPaise };
}
