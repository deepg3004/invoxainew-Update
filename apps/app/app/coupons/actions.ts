"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createCoupon,
  updateCoupon,
  setCouponActive,
  deleteCoupon,
  getSellerGateway,
  type DiscountType,
} from "@invoxai/db";
import { rupeeStringToPaise, percentStringToBps } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";

export type CouponFormState = { error?: string };

const CODE_RE = /^[A-Z0-9][A-Z0-9-]{1,30}$/;
const TYPES: DiscountType[] = ["PERCENT", "FLAT"];

interface ParsedCoupon {
  type: DiscountType;
  value: number;
  minSubtotalPaise: number | null;
  maxRedemptions: number | null;
  startsAt: Date | null;
  expiresAt: Date | null;
}

/** Parse a datetime-local string ("2026-06-20T17:30") into a Date, or null. */
function parseDate(raw: string): { ok: true; value: Date | null } | { ok: false } {
  const s = raw.trim();
  if (!s) return { ok: true, value: null };
  // The datetime-local field carries IST wall-clock ("YYYY-MM-DDTHH:mm"); pin it
  // to the IST offset so it stores the correct instant regardless of server TZ.
  const d = new Date(`${s}:00+05:30`);
  if (Number.isNaN(d.getTime())) return { ok: false };
  return { ok: true, value: d };
}

function parseCouponFields(
  form: FormData,
): { ok: true; value: ParsedCoupon } | { ok: false; message: string } {
  const typeRaw = String(form.get("type") ?? "PERCENT");
  const type = TYPES.includes(typeRaw as DiscountType)
    ? (typeRaw as DiscountType)
    : "PERCENT";

  // `value` means percent for PERCENT (→ bps) and rupees for FLAT (→ paise).
  let value: number;
  if (type === "PERCENT") {
    const pct = percentStringToBps(String(form.get("value") ?? ""));
    if (!pct.ok) return { ok: false, message: `Discount: ${pct.message}` };
    if (pct.bps <= 0) return { ok: false, message: "Discount must be greater than 0%." };
    value = pct.bps;
  } else {
    const flat = rupeeStringToPaise(String(form.get("value") ?? ""));
    if (!flat.ok) return { ok: false, message: `Discount: ${flat.message}` };
    if (flat.paise <= 0) return { ok: false, message: "Discount must be greater than ₹0." };
    value = flat.paise;
  }

  let minSubtotalPaise: number | null = null;
  const minRaw = String(form.get("minSubtotal") ?? "").trim();
  if (minRaw) {
    const min = rupeeStringToPaise(minRaw);
    if (!min.ok) return { ok: false, message: `Minimum order: ${min.message}` };
    minSubtotalPaise = min.paise;
  }

  let maxRedemptions: number | null = null;
  const maxRaw = String(form.get("maxRedemptions") ?? "").trim();
  if (maxRaw) {
    const n = Number(maxRaw);
    if (!Number.isInteger(n) || n < 1) {
      return { ok: false, message: "Usage limit must be a whole number (or blank for unlimited)." };
    }
    maxRedemptions = n;
  }

  const starts = parseDate(String(form.get("startsAt") ?? ""));
  if (!starts.ok) return { ok: false, message: "Start date is invalid." };
  const expires = parseDate(String(form.get("expiresAt") ?? ""));
  if (!expires.ok) return { ok: false, message: "Expiry date is invalid." };
  if (starts.value && expires.value && expires.value <= starts.value) {
    return { ok: false, message: "Expiry must be after the start date." };
  }

  return {
    ok: true,
    value: {
      type,
      value,
      minSubtotalPaise,
      maxRedemptions,
      startsAt: starts.value,
      expiresAt: expires.value,
    },
  };
}

export async function createCouponAction(
  _prev: CouponFormState,
  form: FormData,
): Promise<CouponFormState> {
  const { tenant } = await requireTenant();

  // Coupons discount store sales, which only exist once buyers can pay — mirror
  // the products rule and require a connected gateway.
  const gw = await getSellerGateway(tenant.id);
  if (!gw) return { error: "Connect your payment gateway first (Connect gateway)." };

  const code = String(form.get("code") ?? "").trim().toUpperCase();
  if (!CODE_RE.test(code)) {
    return { error: "Code must be 2–31 chars: letters, digits, hyphens." };
  }

  const parsed = parseCouponFields(form);
  if (!parsed.ok) return { error: parsed.message };

  const active = form.get("active") === "on";
  const result = await createCoupon(tenant.id, {
    code,
    ...parsed.value,
    isActive: active,
  });
  if (!result.ok) return { error: `The code "${code}" already exists.` };

  revalidatePath("/coupons");
  redirect("/coupons");
}

export async function updateCouponAction(
  id: string,
  _prev: CouponFormState,
  form: FormData,
): Promise<CouponFormState> {
  const { tenant } = await requireTenant();
  const parsed = parseCouponFields(form);
  if (!parsed.ok) return { error: parsed.message };

  await updateCoupon(tenant.id, id, parsed.value);
  revalidatePath("/coupons");
  redirect("/coupons");
}

export async function setCouponActiveAction(id: string, isActive: boolean) {
  const { tenant } = await requireTenant();
  await setCouponActive(tenant.id, id, isActive);
  revalidatePath("/coupons");
}

export async function deleteCouponAction(id: string) {
  const { tenant } = await requireTenant();
  await deleteCoupon(tenant.id, id);
  revalidatePath("/coupons");
}
