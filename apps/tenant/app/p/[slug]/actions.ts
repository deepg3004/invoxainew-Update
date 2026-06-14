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
  variantsByProductIds,
} from "@invoxai/db";
import { resolveTenantByHost } from "../../../lib/resolve";
import { getGatewayCredentials } from "../../../lib/gateway";
import { createOrderWithKeys } from "../../../lib/razorpay";
import { getSessionUser } from "../../../lib/auth";
import { readUtmCookie } from "../../../lib/utm";
import { affiliateAttribution } from "../../../lib/affiliate";
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

/**
 * Server-trusted unit price + stock + title for a product line, honouring a
 * chosen variant. If the product HAS variants, a valid variant of THIS product
 * is required (price/stock from the variant, never the client). If it has none,
 * a stray variantId is rejected. Shared by both single-product checkout paths.
 */
async function resolveProductLine(
  product: { id: string; title: string; pricePaise: number; stockQty: number | null },
  variantId: string | null,
): Promise<
  | { ok: true; unitPricePaise: number; stockQty: number | null; titleSnapshot: string }
  | { ok: false; error: string }
> {
  const variants = (await variantsByProductIds([product.id])).get(product.id) ?? [];
  if (variants.length > 0) {
    const v = variantId ? variants.find((x) => x.id === variantId) : null;
    if (!v) return { ok: false, error: `Please choose an option for “${product.title}”.` };
    // Price/title from the variant; stock from the PRODUCT (shared inventory pool
    // in v1 — decrements correctly by productId).
    return {
      ok: true,
      unitPricePaise: v.pricePaise,
      stockQty: product.stockQty,
      titleSnapshot: `${product.title} — ${v.label}`,
    };
  }
  if (variantId) return { ok: false, error: "This product is unavailable." };
  return { ok: true, unitPricePaise: product.pricePaise, stockQty: product.stockQty, titleSnapshot: product.title };
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
  variantId: string | null = null,
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

  // Server-trusted unit price + stock + title (honours a chosen variant).
  const line = await resolveProductLine(product, variantId);
  if (!line.ok) return { ok: false, error: line.error };

  // Stock is tracked only when stockQty is non-null; null = unlimited.
  if (line.stockQty !== null && line.stockQty < qty) {
    return {
      ok: false,
      error: line.stockQty === 0 ? "This product is sold out." : `Only ${line.stockQty} left in stock.`,
    };
  }

  const creds = await getGatewayCredentials(product.tenantId);
  if (!creds) {
    return { ok: false, error: "The seller hasn’t finished setting up payments yet." };
  }

  // Order lines (server-trusted): the product, plus the store's bump add-on if the
  // buyer opted in (price/stock from the DB). Subtotal before discount.
  const bump = addBump ? await resolveBumpLine(product.tenantId, product.id) : null;
  let amountPaise = line.unitPricePaise * qty + (bump?.pricePaise ?? 0);

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
    affiliate: await affiliateAttribution(product.tenantId, amountPaise),
  };

  if (bump) {
    // Bump included → a multi-item order (the proven cart path), so the bump is a
    // real line with its own stock decrement + the commission on the combined total.
    await createCartOrder({
      ...common,
      itemTitle: `${line.titleSnapshot} + 1 add-on`,
      items: [
        {
          productId: product.id,
          titleSnapshot: line.titleSnapshot,
          unitPricePaise: line.unitPricePaise,
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
      itemTitle: line.titleSnapshot,
    });
  }

  return {
    ok: true,
    orderId: order.id,
    amountPaise,
    keyId: creds.keyId,
    title: line.titleSnapshot,
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
  variantId: string | null = null,
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

  // Server-trusted unit price + stock + title (honours a chosen variant).
  const line = await resolveProductLine(product, variantId);
  if (!line.ok) return { ok: false, error: line.error };

  if (line.stockQty !== null && line.stockQty < qty) {
    return {
      ok: false,
      error: line.stockQty === 0 ? "This product is sold out." : `Only ${line.stockQty} left in stock.`,
    };
  }

  const upi = await getEnabledSellerUpi(product.tenantId);
  if (!upi) return { ok: false, error: "UPI isn’t available for this seller." };

  // Server-trusted subtotal (+ optional bump) + authoritative coupon (same as
  // startProductCheckout).
  const bump = addBump ? await resolveBumpLine(product.tenantId, product.id) : null;
  let amountPaise = line.unitPricePaise * qty + (bump?.pricePaise ?? 0);
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
          itemTitle: `${line.titleSnapshot} + 1 add-on`,
          items: [
            {
              productId: product.id,
              titleSnapshot: line.titleSnapshot,
              unitPricePaise: line.unitPricePaise,
              quantity: qty,
            },
            bump.line,
          ],
        }
      : { productId: product.id, quantity: qty, itemTitle: line.titleSnapshot }),
    couponId,
    couponCode: couponSnapshot,
    discountPaise,
    buyerProfileId: user?.id ?? null,
    buyerEmail: buyer.email ?? user?.email ?? null,
    buyerContact: buyer.contact ?? null,
    utm: await readUtmCookie(),
    affiliate: await affiliateAttribution(product.tenantId, amountPaise),
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
  variantId: string | null = null,
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

  // Price against the chosen variant so the previewed discount matches the charge.
  const line = await resolveProductLine(product, variantId);
  if (!line.ok) return { ok: false, error: line.error };

  const result = await applyCoupon(product.tenantId, trimmed, line.unitPricePaise * qty);
  if (!result.ok) return { ok: false, error: couponErrorMessage(result) };
  return { ok: true, code: result.code, discountPaise: result.discountPaise };
}
