"use server";

import {
  getActivePaymentPageById,
  createBuyerPayment,
  isTenantSuspended,
} from "@invoxai/db";
import { getGatewayCredentials } from "../../../lib/gateway";
import { createOrderWithKeys } from "../../../lib/razorpay";
import { getSessionUser } from "../../../lib/auth";

export type StartBuyerResult =
  | { ok: false; error: string }
  | {
      ok: true;
      orderId: string;
      amountPaise: number;
      keyId: string;
      title: string;
    };

/**
 * Start a buyer checkout for a payment page. SECURITY: the page id is the only
 * client input; the amount and the owning tenant are read from the DB
 * (server-trusted). The Razorpay order is created on the SELLER's gateway, so
 * funds settle to the seller — InvoxAI never holds buyer money.
 */
export async function startBuyerCheckout(
  paymentPageId: string,
  buyer: { email?: string; contact?: string },
): Promise<StartBuyerResult> {
  const page = await getActivePaymentPageById(paymentPageId);
  if (!page) return { ok: false, error: "This payment page is unavailable." };

  // Suspended store can't take payments (Phase 3 admin).
  if (await isTenantSuspended(page.tenantId)) {
    return { ok: false, error: "This store is temporarily unavailable." };
  }

  const creds = await getGatewayCredentials(page.tenantId);
  if (!creds) {
    return { ok: false, error: "The seller hasn’t finished setting up payments yet." };
  }

  const order = await createOrderWithKeys(creds.keyId, creds.keySecret, {
    amountPaise: page.amountPaise,
    receipt: `pp_${page.id}`.slice(0, 40),
    notes: { paymentPageId: page.id, tenantId: page.tenantId },
  });

  // Guest checkout: attribute the order to the buyer's account only if they
  // happen to be signed in (C8). Email still captures guest orders for later.
  const user = await getSessionUser();

  await createBuyerPayment({
    razorpayOrderId: order.id,
    tenantId: page.tenantId,
    paymentPageId: page.id,
    itemTitle: page.title,
    amountPaise: page.amountPaise,
    buyerProfileId: user?.id ?? null,
    buyerEmail: buyer.email ?? user?.email ?? null,
    buyerContact: buyer.contact ?? null,
  });

  return {
    ok: true,
    orderId: order.id,
    amountPaise: page.amountPaise,
    keyId: creds.keyId,
    title: page.title,
  };
}
