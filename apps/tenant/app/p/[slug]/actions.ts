"use server";

import {
  getPublishedProductById,
  createBuyerPayment,
  isTenantSuspended,
} from "@invoxai/db";
import { getGatewayCredentials } from "../../../lib/gateway";
import { createOrderWithKeys } from "../../../lib/razorpay";
import { getSessionUser } from "../../../lib/auth";

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

  const amountPaise = product.pricePaise * qty;
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
