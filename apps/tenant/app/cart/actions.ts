"use server";

import { headers } from "next/headers";
import { tenantUsernameFromHost } from "@invoxai/utils/host";
import {
  getTenantByUsername,
  getPublishedProductById,
  createCartOrder,
  isTenantSuspended,
} from "@invoxai/db";
import { getGatewayCredentials } from "../../lib/gateway";
import { createOrderWithKeys } from "../../lib/razorpay";
import { getSessionUser } from "../../lib/auth";

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
): Promise<StartCartResult> {
  if (!Array.isArray(lines) || lines.length === 0) {
    return { ok: false, error: "Your cart is empty." };
  }

  const host = (await headers()).get("host");
  const username = tenantUsernameFromHost(host);
  if (!username) return { ok: false, error: "This store is unavailable." };
  const tenant = await getTenantByUsername(username);
  if (!tenant) return { ok: false, error: "This store is unavailable." };

  if (await isTenantSuspended(tenant.id)) {
    return { ok: false, error: "This store is temporarily unavailable." };
  }

  // Merge duplicate lines and validate each against the DB (server-trusted).
  const merged = new Map<string, number>();
  for (const line of lines) {
    const qty = Math.floor(Number(line.qty));
    if (!line.productId || !Number.isInteger(qty) || qty < 1 || qty > 99) {
      return { ok: false, error: "Invalid item in your cart. Please review it." };
    }
    merged.set(line.productId, (merged.get(line.productId) ?? 0) + qty);
  }

  const items: {
    productId: string;
    titleSnapshot: string;
    unitPricePaise: number;
    quantity: number;
  }[] = [];
  let amountPaise = 0;

  for (const [productId, qty] of merged) {
    if (qty > 99) return { ok: false, error: "Quantity too high for an item." };
    const product = await getPublishedProductById(productId);
    if (!product || product.tenantId !== tenant.id) {
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
    buyerProfileId: user?.id ?? null,
    buyerEmail: buyer.email ?? user?.email ?? null,
    buyerContact: buyer.contact ?? null,
  });

  return { ok: true, orderId: order.id, amountPaise, keyId: creds.keyId, title };
}
