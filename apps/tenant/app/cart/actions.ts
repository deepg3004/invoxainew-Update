"use server";

import { headers } from "next/headers";
import { tenantUsernameFromHost } from "@invoxai/utils/host";
import {
  getTenantByUsername,
  getPublishedProductById,
  createCartOrder,
  applyCoupon,
  isTenantSuspended,
} from "@invoxai/db";
import { getGatewayCredentials } from "../../lib/gateway";
import { createOrderWithKeys } from "../../lib/razorpay";
import { getSessionUser } from "../../lib/auth";
import { couponErrorMessage } from "../../lib/coupon-message";

export type StartCartResult =
  | { ok: false; error: string }
  | {
      ok: true;
      orderId: string;
      amountPaise: number;
      keyId: string;
      title: string;
    };

export interface CartLine {
  productId: string;
  qty: number;
}

export type PreviewCouponResult =
  | { ok: true; code: string; discountPaise: number }
  | { ok: false; error: string };

/**
 * Read-only coupon preview for the cart UI. Resolves the tenant from the host,
 * re-prices the cart server-trusted (NEVER trusts the client's totals), and
 * validates the code. This only previews the discount — the authoritative apply
 * happens again inside startCartCheckout, so a stale/forged preview can't change
 * what the buyer is actually charged.
 */
export async function previewCartCoupon(
  lines: CartLine[],
  code: string,
): Promise<PreviewCouponResult> {
  const trimmed = (code ?? "").trim();
  if (!trimmed) return { ok: false, error: "Enter a code." };

  const host = (await headers()).get("host");
  const username = tenantUsernameFromHost(host);
  if (!username) return { ok: false, error: "This store is unavailable." };
  const tenant = await getTenantByUsername(username);
  if (!tenant) return { ok: false, error: "This store is unavailable." };

  const priced = await priceCart(lines, tenant.id);
  if (!priced.ok) return { ok: false, error: priced.error };

  const result = await applyCoupon(tenant.id, trimmed, priced.amountPaise);
  if (!result.ok) return { ok: false, error: couponErrorMessage(result) };
  return { ok: true, code: result.code, discountPaise: result.discountPaise };
}

interface PricedCart {
  ok: true;
  items: {
    productId: string;
    titleSnapshot: string;
    unitPricePaise: number;
    quantity: number;
  }[];
  amountPaise: number;
}

/**
 * Validate cart lines against the DB and compute the server-trusted subtotal.
 * Shared by the coupon preview and the checkout start so both price the cart
 * identically. The only client inputs are {productId, qty}; prices/titles/stock
 * come from the DB.
 */
async function priceCart(
  lines: CartLine[],
  tenantId: string,
): Promise<PricedCart | { ok: false; error: string }> {
  if (!Array.isArray(lines) || lines.length === 0) {
    return { ok: false, error: "Your cart is empty." };
  }

  const merged = new Map<string, number>();
  for (const line of lines) {
    const qty = Math.floor(Number(line.qty));
    if (!line.productId || !Number.isInteger(qty) || qty < 1 || qty > 99) {
      return { ok: false, error: "Invalid item in your cart. Please review it." };
    }
    merged.set(line.productId, (merged.get(line.productId) ?? 0) + qty);
  }

  const items: PricedCart["items"] = [];
  let amountPaise = 0;
  for (const [productId, qty] of merged) {
    if (qty > 99) return { ok: false, error: "Quantity too high for an item." };
    const product = await getPublishedProductById(productId);
    if (!product || product.tenantId !== tenantId) {
      return { ok: false, error: "An item in your cart is no longer available." };
    }
    if (product.stockQty !== null && product.stockQty < qty) {
      return {
        ok: false,
        error:
          product.stockQty === 0
            ? `“${product.title}” is sold out.`
            : `Only ${product.stockQty} of “${product.title}” left.`,
      };
    }
    items.push({
      productId: product.id,
      titleSnapshot: product.title,
      unitPricePaise: product.pricePaise,
      quantity: qty,
    });
    amountPaise += product.pricePaise * qty;
  }

  if (amountPaise <= 0) {
    return { ok: false, error: "Your cart total is invalid." };
  }
  return { ok: true, items, amountPaise };
}

/**
 * Start a multi-item (cart) checkout — Store slice 3.
 *
 * SECURITY / hard rules:
 *  - The tenant is resolved from the request HOST, and EVERY product must belong
 *    to that tenant. A cart can't mix two sellers' products (that would put one
 *    seller's item on another seller's gateway). Cross-tenant lines are rejected.
 *  - The only client inputs are {productId, qty}. Unit prices, titles and stock
 *    are read from the DB (server-trusted); the total is computed here. The
 *    client-stored price is never trusted.
 *  - One Razorpay order is created on the SELLER's own gateway, so funds settle
 *    seller-direct — InvoxAI never holds buyer money. Commission is taken from
 *    the seller wallet on PAID (same rail as single-item; see markBuyerPaymentPaid).
 */
export async function startCartCheckout(
  lines: CartLine[],
  buyer: { email?: string; contact?: string },
  couponCode?: string,
): Promise<StartCartResult> {
  const host = (await headers()).get("host");
  const username = tenantUsernameFromHost(host);
  if (!username) return { ok: false, error: "This store is unavailable." };
  const tenant = await getTenantByUsername(username);
  if (!tenant) return { ok: false, error: "This store is unavailable." };

  if (await isTenantSuspended(tenant.id)) {
    return { ok: false, error: "This store is temporarily unavailable." };
  }

  // Validate + price the cart against the DB (server-trusted). `amountPaise`
  // here is the SUBTOTAL before any discount.
  const priced = await priceCart(lines, tenant.id);
  if (!priced.ok) return { ok: false, error: priced.error };
  const { items } = priced;
  let amountPaise = priced.amountPaise;

  // Apply a coupon if supplied — authoritative (re-validated + recomputed here,
  // never trusting any client-side discount). amountPaise becomes the charged,
  // post-discount total, which is what commission is later computed on.
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

  const creds = await getGatewayCredentials(tenant.id);
  if (!creds) {
    return { ok: false, error: "The seller hasn’t finished setting up payments yet." };
  }

  // A short human summary so existing order displays render uniformly without
  // reading the lines. The lines themselves are persisted on the order.
  const title =
    items.length === 1
      ? items[0]!.titleSnapshot
      : `${items[0]!.titleSnapshot} + ${items.length - 1} more`;

  const order = await createOrderWithKeys(creds.keyId, creds.keySecret, {
    amountPaise,
    receipt: `cart_${tenant.id}`.slice(0, 40),
    notes: { tenantId: tenant.id, items: String(items.length) },
  });

  const user = await getSessionUser();

  await createCartOrder({
    razorpayOrderId: order.id,
    tenantId: tenant.id,
    amountPaise,
    itemTitle: title,
    items,
    couponId,
    couponCode: couponSnapshot,
    discountPaise,
    buyerProfileId: user?.id ?? null,
    buyerEmail: buyer.email ?? user?.email ?? null,
    buyerContact: buyer.contact ?? null,
  });

  return { ok: true, orderId: order.id, amountPaise, keyId: creds.keyId, title };
}
