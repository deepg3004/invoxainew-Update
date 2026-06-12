import { formatRupees } from "@invoxai/utils/money";
import type { ApplyCouponResult } from "@invoxai/db";

type Failure = Extract<ApplyCouponResult, { ok: false }>;

/** Buyer-facing message for a failed coupon application. */
export function couponErrorMessage(failure: Failure): string {
  switch (failure.reason) {
    case "not_found":
      return "That code isn’t valid.";
    case "inactive":
      return "That code is no longer active.";
    case "not_started":
      return "That code isn’t active yet.";
    case "expired":
      return "That code has expired.";
    case "fully_redeemed":
      return "That code has reached its limit.";
    case "min_subtotal":
      return failure.minSubtotalPaise
        ? `Add ${formatRupees(failure.minSubtotalPaise)} or more to use this code.`
        : "Your cart doesn’t qualify for this code.";
  }
}
