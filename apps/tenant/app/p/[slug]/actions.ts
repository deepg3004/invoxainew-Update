"use server";

import { headers } from "next/headers";
import {
  getPublishedProductById,
  createBuyerPayment,
  createCartOrder,
  getOrderBumpProduct,
  applyCoupon,
  isTenantSuspended,
  getEnabledSellerUpi,
  createUpiSession,
} from "@invoxai/db";
import { resolveTenantByHost } from "../../../lib/resolve";
import { getGatewayCredentials } from "../../../lib/gateway";
import { createOrderWithKeys } from "../../../lib/razorpay";
import { getSessionUser } from "../../../lib/auth";
import { readUtmCookie } from "../../../lib/utm";
import { couponErrorMessage } from "../../../lib/coupon-message";
import type { StartUpiSessionResult } from "../../../lib/upi";

/**
 * The store that owns THIS request, from the Host header (the single source of
 * truth for "which tenant"). Buyer checkout actions resolve the product within
 * this tenant so a foreign productId can't be checked out through another store.
 */
async function currentTenant() {
  const host = (await headers()).get("host");
  return resolveTenantByHost(host);
}

type OrderLine = {
  productId: string;
  titleSnapshot: string;
  unitPricePaise: number;
  quantity: number;
};

/**
 * Server-trusted order bump for a product checkout: the store's bump add-on, but
 * only if it exists, is in stock, and ISN'T the product being bought. Returns the
 * extra line + its price, or null. The price/stock come from the DB, never the
 * client — `addBump` from the client is just a yes/no.
 */
async function resolveBumpLine(
  tenantId: string,
  mainProductId: string,
): Promise<{ line: OrderLine; pricePaise: number } | null> {
  const bump = await getOrderBumpProduct(tenantId);
  if (!bump || bump.id === mainProductId) return null;
  return {
    line: {
      productId: bump.id,
      titleSnapshot: bump.title,
      unitPricePaise: bump.pricePaise,
      quantity: 1,
    },
    pricePaise: bump.pricePaise,
  };
}

export type StartProductResult =
  | { ok: false; error: string }
  | {
      ok: true;
      orderId: string;
      amountPaise: number;
      keyId: string;
      title: string;
    };

/**
 * Start a buyer checkout for a store product (Store slice 2). SECURITY: the
 * product id + quantity are the only client inputs; the unit price and owning
 * tenant are read from the DB (server-trusted) and the total is computed here.
 * The Razorpay order is created on the SELLER's gateway, so funds settle to the
 * seller — InvoxAI never holds buyer money (same rail as payment pages).
 */
export async function startProductCheckout(
  productId: string,
  quantity: number,
  buyer: { email?: string; contact?: string },
  couponCode?: string,
  addBump = false,
): Promise<StartProductResult> {
  const qty = Math.floor(Number(quantity));
  if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
    return { ok: false, error: "Choose a quantity between 1 and 99." };
  }

  const tenant = await currentTenant();
  if (!tenant) return { ok: false, error: "This store is unavailable." };

  const product = await getPublishedProductById(tenant.id, productId);
  if (!product) return { ok: false, error: "This product is unavailable." };

  if (await isTenantSuspended(product.tenantId)) {
    return { ok: false, error: "This store is temporarily unavailable." };
  }

  // Stock is tracked only when stockQty is non-null; null = unlimited.
  if (product.stockQty !== null && product.stockQty < qty) {
    return {
      ok: false,
      error:
        product.stockQty === 0
          ? "This product is sold out."
          : `Only ${product.stockQty} left in stock.`,
    };
  }

  const creds = await getGatewayCredentials(product.tenantId);
  if (!creds) {
    return { ok: false, error: "The seller hasn’t finished setting up payments yet." };
  }

  // Order lines (server-trusted): the product, plus the store's bump add-on if the
  // buyer opted in (price/stock from the DB). Subtotal before discount.
  const bump = addBump ? await resolveBumpLine(product.tenantId, product.id) : null;
  let amountPaise = product.pricePaise * qty + (bump?.pricePaise ?? 0);

  // Apply a coupon if supplied — authoritative (re-validated + recomputed here),
  // against the combined subtotal. amountPaise becomes the charged total.
  const code = (couponCode ?? "").trim();
  let couponId: string | null = null;
  let couponSnapshot: string | null = null;
  let discountPaise = 0;
  if (code) {
    const result = await applyCoupon(product.tenantId, code, amountPaise);
    if (!result.ok) return { ok: false, error: couponErrorMessage(result) };
    couponId = result.couponId;
    couponSnapshot = result.code;
    discountPaise = result.discountPaise;
    amountPaise -= discountPaise;
  }

  const order = await createOrderWithKeys(creds.keyId, creds.keySecret, {
    amountPaise,
    receipt: `prod_${product.id}`.slice(0, 40),
    notes: { productId: product.id, tenantId: product.tenantId, quantity: String(qty) },
  });

  const user = await getSessionUser();
  const common = {
    razorpayOrderId: order.id,
    tenantId: product.tenantId,
    amountPaise,
    couponId,
    couponCode: couponSnapshot,
    discountPaise,
    buyerProfileId: user?.id ?? null,
    buyerEmail: buyer.email ?? user?.email ?? null,
    buyerContact: buyer.contact ?? null,
    utm: await readUtmCookie(),
  };

  if (bump) {
    // Bump included → a multi-item order (the proven cart path), so the bump is a
    // real line with its own stock decrement + the commission on the combined total.
    await createCartOrder({
      ...common,
      itemTitle: `${product.title} + 1 add-on`,
      items: [
        {
          productId: product.id,
          titleSnapshot: product.title,
          unitPricePaise: product.pricePaise,
          quantity: qty,
        },
        bump.line,
      ],
    });
  } else {
    // No bump → unchanged single-item order.
    await createBuyerPayment({
      ...common,
      productId: product.id,
      quantity: qty,
      itemTitle: product.title,
    });
  }

  return {
    ok: true,
    orderId: order.id,
    amountPaise,
    keyId: creds.keyId,
    title: product.title,
  };
}

/**
 * Start a manual-UPI session for a store product. Mirrors startProductCheckout's
 * server-trusted validation (qty, stock, coupon re-applied) to compute the base
 * amount, then reserves a unique-amount UPI session (createUpiSession). The buyer
 * pays + submits their reference via the shared submitUpiRef; nothing is paid /
 * no commission until then.
 */
export async function startProductUpiSession(
  productId: string,
  quantity: number,
  buyer: { email?: string; contact?: string },
  couponCode?: string,
  addBump = false,
): Promise<StartUpiSessionResult> {
  const qty = Math.floor(Number(quantity));
  if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
    return { ok: false, error: "Choose a quantity between 1 and 99." };
  }

  const tenant = await currentTenant();
  if (!tenant) return { ok: false, error: "This store is unavailable." };

  const product = await getPublishedProductById(tenant.id, productId);
  if (!product) return { ok: false, error: "This product is unavailable." };

  if (await isTenantSuspended(product.tenantId)) {
    return { ok: false, error: "This store is temporarily unavailable." };
  }

  if (product.stockQty !== null && product.stockQty < qty) {
    return {
      ok: false,
      error:
        product.stockQty === 0
          ? "This product is sold out."
          : `Only ${product.stockQty} left in stock.`,
    };
  }

  const upi = await getEnabledSellerUpi(product.tenantId);
  if (!upi) return { ok: false, error: "UPI isn’t available for this seller." };

  // Server-trusted subtotal (+ optional bump) + authoritative coupon (same as
  // startProductCheckout).
  const bump = addBump ? await resolveBumpLine(product.tenantId, product.id) : null;
  let amountPaise = product.pricePaise * qty + (bump?.pricePaise ?? 0);
  const code = (couponCode ?? "").trim();
  let couponId: string | null = null;
  let couponSnapshot: string | null = null;
  let discountPaise = 0;
  if (code) {
    const result = await applyCoupon(product.tenantId, code, amountPaise);
    if (!result.ok) return { ok: false, error: couponErrorMessage(result) };
    couponId = result.couponId;
    couponSnapshot = result.code;
    discountPaise = result.discountPaise;
    amountPaise -= discountPaise;
  }

  const user = await getSessionUser();
  const session = await createUpiSession({
    tenantId: product.tenantId,
    amountPaise,
    ttlMinutes: upi.sessionTtlMinutes,
    // Bump → multi-item session (lines carry both products' stock); else the
    // single-product session, unchanged.
    ...(bump
      ? {
          itemTitle: `${product.title} + 1 add-on`,
          items: [
            {
              productId: product.id,
              titleSnapshot: product.title,
              unitPricePaise: product.pricePaise,
              quantity: qty,
            },
            bump.line,
          ],
        }
      : { productId: product.id, quantity: qty, itemTitle: product.title }),
    couponId,
    couponCode: couponSnapshot,
    discountPaise,
    buyerProfileId: user?.id ?? null,
    buyerEmail: buyer.email ?? user?.email ?? null,
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

export type PreviewCouponResult =
  | { ok: true; code: string; discountPaise: number }
  | { ok: false; error: string };

/**
 * Read-only coupon preview for the product buy box. Re-prices server-trusted
 * (qty × DB price) and validates the code. The authoritative apply still runs in
 * startProductCheckout, so this preview can't change what the buyer is charged.
 */
export async function previewProductCoupon(
  productId: string,
  quantity: number,
  code: string,
): Promise<PreviewCouponResult> {
  const trimmed = (code ?? "").trim();
  if (!trimmed) return { ok: false, error: "Enter a code." };
  const qty = Math.floor(Number(quantity));
  if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
    return { ok: false, error: "Choose a valid quantity first." };
  }
  const tenant = await currentTenant();
  if (!tenant) return { ok: false, error: "This store is unavailable." };

  const product = await getPublishedProductById(tenant.id, productId);
  if (!product) return { ok: false, error: "This product is unavailable." };

  const result = await applyCoupon(product.tenantId, trimmed, product.pricePaise * qty);
  if (!result.ok) return { ok: false, error: couponErrorMessage(result) };
  return { ok: true, code: result.code, discountPaise: result.discountPaise };
}
