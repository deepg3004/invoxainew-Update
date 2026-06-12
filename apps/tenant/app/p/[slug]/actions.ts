"use server";

import {
  getPublishedProductById,
  createBuyerPayment,
  applyCoupon,
  isTenantSuspended,
} from "@invoxai/db";
import { getGatewayCredentials } from "../../../lib/gateway";
import { createOrderWithKeys } from "../../../lib/razorpay";
import { getSessionUser } from "../../../lib/auth";
import { couponErrorMessage } from "../../../lib/coupon-message";

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
): Promise<StartProductResult> {
  const qty = Math.floor(Number(quantity));
  if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
    return { ok: false, error: "Choose a quantity between 1 and 99." };
  }

  const product = await getPublishedProductById(productId);
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

  // Subtotal before discount (server-trusted).
  let amountPaise = product.pricePaise * qty;

  // Apply a coupon if supplied — authoritative (re-validated + recomputed here).
  // amountPaise becomes the charged, post-discount total commission is taken on.
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

  await createBuyerPayment({
    razorpayOrderId: order.id,
    tenantId: product.tenantId,
    productId: product.id,
    quantity: qty,
    itemTitle: product.title,
    amountPaise,
    couponId,
    couponCode: couponSnapshot,
    discountPaise,
    buyerProfileId: user?.id ?? null,
    buyerEmail: buyer.email ?? user?.email ?? null,
    buyerContact: buyer.contact ?? null,
  });

  return {
    ok: true,
    orderId: order.id,
    amountPaise,
    keyId: creds.keyId,
    title: product.title,
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
  const product = await getPublishedProductById(productId);
  if (!product) return { ok: false, error: "This product is unavailable." };

  const result = await applyCoupon(product.tenantId, trimmed, product.pricePaise * qty);
  if (!result.ok) return { ok: false, error: couponErrorMessage(result) };
  return { ok: true, code: result.code, discountPaise: result.discountPaise };
}
