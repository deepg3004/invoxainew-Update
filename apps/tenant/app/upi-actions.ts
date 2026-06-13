"use server";

import { headers } from "next/headers";
import { autoConfirmOrHoldUpiOrder, notifyTenant } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { resolveTenantByHost } from "../lib/resolve";
import { notifySaleEffects } from "../lib/notify-sale";
import { UTR_RE, type SubmitUpiRefResult } from "../lib/upi";

/**
 * Shared across every buyer surface: the buyer submits their UPI reference for a
 * session created by a `start*UpiSession` action. The order is resolved by id AND
 * the host-resolved tenant (so a forged id can't touch another seller's order),
 * then either auto-confirmed instantly (paid + access + commission) or held for
 * the seller's manual confirmation — never refused. Amount/tenant are server-
 * trusted from the session row; nothing the buyer sends changes what's charged.
 */
export async function submitUpiRef(
  buyerPaymentId: string,
  upiRefRaw: string,
): Promise<SubmitUpiRefResult> {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) return { ok: false, error: "This store is unavailable." };

  const ref = (upiRefRaw ?? "").trim();
  if (!UTR_RE.test(ref)) {
    return { ok: false, error: "Enter the UPI transaction reference (UTR) from your payment app." };
  }

  const res = await autoConfirmOrHoldUpiOrder(tenant.id, buyerPaymentId, ref);
  if (!res.ok) {
    if (res.reason === "duplicate") {
      return {
        ok: false,
        error: "That reference is already on another order — paste the exact UTR from your payment.",
      };
    }
    // expired / not_found → the session is gone; offer a restart.
    return { ok: false, error: "This payment session expired. Please start again.", expired: true };
  }

  // Best-effort seller notifications (never block the buyer). Fire once: on the
  // first auto-confirm (the sale) or the first hold (a payment to confirm).
  if (res.confirmed) {
    if (!res.alreadyProcessed) {
      await notifySaleEffects({
        tenantId: tenant.id,
        buyerPaymentId: res.buyerPaymentId,
        itemTitle: res.itemTitle,
        amountPaise: res.amountPaise,
        commission: res.commission,
      });
    }
  } else if (!res.alreadyProcessed) {
    await notifyTenant(tenant.id, {
      type: "upi_pending",
      title: "UPI payment to confirm",
      body: `${res.itemTitle ?? "An order"} — ${formatRupees(res.amountPaise)}. Check your UPI app, then confirm it.`,
      link: "/orders",
    }).catch(() => {});
  }

  return { ok: true, confirmed: res.confirmed };
}
