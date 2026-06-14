"use server";

import { headers } from "next/headers";
import {
  listPublishedProductsByIds,
  createCartOrder,
  getOrderBumpProduct,
  applyCoupon,
  isTenantSuspended,
  getEnabledSellerUpi,
  createUpiSession,
  variantsByProductIds,
} from "@invoxai/db";
import { getGatewayCredentials } from "../../lib/gateway";
import { createOrderWithKeys } from "../../lib/razorpay";
import { getSessionUser } from "../../lib/auth";
import { couponErrorMessage } from "../../lib/coupon-message";
import { resolveTenantByHost } from "../../lib/resolve";
import { readUtmCookie } from "../../lib/utm";
import { affiliateAttribution } from "../../lib/affiliate";
import type { StartUpiSessionResult } from "../../lib/upi";

/**
 * Add the store's order-bump product as an extra cart line (qty 1) when the buyer
 * opted in — unless it's already in the cart. Returns the lines unchanged when
 * there's no bump or `addBump` is false. The bump is then priced/stock-checked by
 * priceCart like any other line (server-trusted), so the client only sends a flag.
 */
async function withBumpLine(
  tenantId: string,
  lines: CartLine[],
  addBump: boolean,
): Promise<CartLine[]> {
  if (!addBump) return lines;
  const bump = await getOrderBumpProduct(tenantId);
  if (!bump || lines.some((l) => l.productId === bump.id)) return lines;
  return [...lines, { productId: bump.id, qty: 1 }];
}

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
  variantId?: string | null;
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
  const tenant = await resolveTenantByHost(host);
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

  // Merge by (productId, variantId) so two variants of one product are distinct
  // lines. The variantId is server-validated below; an invalid one is rejected.
  const merged = new Map<string, { productId: string; variantId: string | null; qty: number }>();
  for (const line of lines) {
    const qty = Math.floor(Number(line.qty));
    if (!line.productId || !Number.isInteger(qty) || qty < 1 || qty > 99) {
      return { ok: false, error: "Invalid item in your cart. Please review it." };
    }
    const variantId = line.variantId ? String(line.variantId) : null;
    const key = `${line.productId}::${variantId ?? ""}`;
    const prev = merged.get(key);
    merged.set(key, { productId: line.productId, variantId, qty: (prev?.qty ?? 0) + qty });
  }

  // One batched, tenant-scoped lookup instead of an await-per-line N+1, plus the
  // server-trusted variants for those products (price/stock NEVER from the client).
  const productIds = [...new Set([...merged.values()].map((m) => m.productId))];
  const products = await listPublishedProductsByIds(tenantId, productIds);
  const byId = new Map(products.map((p) => [p.id, p]));
  const variantsBy = await variantsByProductIds(productIds);

  const items: PricedCart["items"] = [];
  let amountPaise = 0;
  for (const { productId, variantId, qty } of merged.values()) {
    if (qty > 99) return { ok: false, error: "Quantity too high for an item." };
    const product = byId.get(productId);
    if (!product) {
      // Not found / wrong tenant / unpublished — the query already scoped both.
      return { ok: false, error: "An item in your cart is no longer available." };
    }
    const variants = variantsBy.get(productId) ?? [];

    // Resolve the server-trusted unit price + title for this line. Stock is the
    // PRODUCT's (variants share the product's inventory pool in v1; per-variant
    // stock is a future enhancement), so it decrements correctly by productId.
    let unitPricePaise = product.pricePaise;
    const stockQty = product.stockQty;
    let titleSnapshot = product.title;
    if (variants.length > 0) {
      // A variant product MUST be bought with a valid variant of THIS product.
      const variant = variantId ? variants.find((v) => v.id === variantId) : null;
      if (!variant) {
        return { ok: false, error: `Please choose an option for “${product.title}”.` };
      }
      unitPricePaise = variant.pricePaise;
      titleSnapshot = `${product.title} — ${variant.label}`;
    } else if (variantId) {
      // Client sent a variant for a product that has none — reject (don't ignore).
      return { ok: false, error: "An item in your cart is no longer available." };
    }

    if (stockQty !== null && stockQty < qty) {
      return {
        ok: false,
        error:
          stockQty === 0 ? `“${titleSnapshot}” is sold out.` : `Only ${stockQty} of “${titleSnapshot}” left.`,
      };
    }
    items.push({ productId: product.id, titleSnapshot, unitPricePaise, quantity: qty });
    amountPaise += unitPricePaise * qty;
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
  addBump = false,
): Promise<StartCartResult> {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) return { ok: false, error: "This store is unavailable." };

  if (await isTenantSuspended(tenant.id)) {
    return { ok: false, error: "This store is temporarily unavailable." };
  }

  // Validate + price the cart (+ the bump line if opted in) against the DB
  // (server-trusted). `amountPaise` here is the SUBTOTAL before any discount.
  const priced = await priceCart(await withBumpLine(tenant.id, lines, addBump), tenant.id);
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
    utm: await readUtmCookie(),
    affiliate: await affiliateAttribution(tenant.id, amountPaise),
  });

  return { ok: true, orderId: order.id, amountPaise, keyId: creds.keyId, title };
}

/**
 * Start a manual-UPI session for a multi-item cart. Mirrors startCartCheckout's
 * server-trusted, single-tenant pricing (every line must belong to the host's
 * tenant; prices/stock from the DB; coupon re-applied) to compute the base
 * amount, then reserves a unique-amount UPI session with the cart's line items.
 * The buyer pays + submits their reference via the shared submitUpiRef.
 */
export async function startCartUpiSession(
  lines: CartLine[],
  buyer: { email?: string; contact?: string },
  couponCode?: string,
  addBump = false,
): Promise<StartUpiSessionResult> {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) return { ok: false, error: "This store is unavailable." };

  if (await isTenantSuspended(tenant.id)) {
    return { ok: false, error: "This store is temporarily unavailable." };
  }

  const priced = await priceCart(await withBumpLine(tenant.id, lines, addBump), tenant.id);
  if (!priced.ok) return { ok: false, error: priced.error };
  const { items } = priced;
  let amountPaise = priced.amountPaise;

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

  const upi = await getEnabledSellerUpi(tenant.id);
  if (!upi) return { ok: false, error: "UPI isn’t available for this seller." };

  const title =
    items.length === 1
      ? items[0]!.titleSnapshot
      : `${items[0]!.titleSnapshot} + ${items.length - 1} more`;

  const user = await getSessionUser();
  const session = await createUpiSession({
    tenantId: tenant.id,
    amountPaise,
    ttlMinutes: upi.sessionTtlMinutes,
    itemTitle: title,
    items,
    couponId,
    couponCode: couponSnapshot,
    discountPaise,
    buyerProfileId: user?.id ?? null,
    buyerEmail: buyer.email ?? user?.email ?? null,
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
