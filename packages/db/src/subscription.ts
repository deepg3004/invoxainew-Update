import { Prisma } from "@prisma/client";
import { prisma } from "./client";
import { settleDueCommissions } from "./payments";

/**
 * Platform subscription + checkout-order data access (C4).
 *
 * MONEY-SAFETY lives here. Two invariants:
 *  1. Tenant isolation — every read/write takes a `tenantId` that the caller
 *     derived from the authenticated session, never from client input.
 *  2. Idempotency — paying for an order activates the subscription EXACTLY once,
 *     even if the synchronous verify callback and the async webhook both fire,
 *     or a webhook is redelivered. The activation is guarded by an atomic
 *     conditional update on the order, so the period is never extended twice.
 *
 * Amounts are integer paise. These rows hold ONLY InvoxAI's own fees (seller →
 * InvoxAI), never buyer→seller money.
 */

/** Add one billing cycle to a date (immutable). */
function addCycle(from: Date, cycle: "MONTHLY" | "YEARLY"): Date {
  const d = new Date(from);
  if (cycle === "YEARLY") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

/** The tenant's subscription (with its plan), or null. Scoped by tenantId. */
export function getSubscriptionByTenant(tenantId: string) {
  return prisma.subscription.findUnique({
    where: { tenantId },
    include: { plan: true },
  });
}

/**
 * Record a checkout order created against the platform gateway. `purpose`
 * decides what paying it does (subscription vs wallet top-up); planId/cycle are
 * required for SUBSCRIPTION and omitted for WALLET_TOPUP.
 */
export function createPlatformOrder(input: {
  razorpayOrderId: string;
  tenantId: string;
  purpose: "SUBSCRIPTION" | "WALLET_TOPUP";
  planId?: string | null;
  billingCycle?: "MONTHLY" | "YEARLY" | null;
  amountPaise: number;
}) {
  return prisma.platformOrder.create({
    data: {
      razorpayOrderId: input.razorpayOrderId,
      tenantId: input.tenantId,
      purpose: input.purpose,
      planId: input.planId ?? null,
      billingCycle: input.billingCycle ?? null,
      amountPaise: input.amountPaise,
    },
    select: { id: true, razorpayOrderId: true },
  });
}

export function getPlatformOrderByRazorpayId(razorpayOrderId: string) {
  return prisma.platformOrder.findUnique({
    where: { razorpayOrderId },
    include: { plan: true, tenant: true },
  });
}

export type PaidOrderResult =
  | { ok: true; alreadyProcessed: boolean; purpose: "SUBSCRIPTION" | "WALLET_TOPUP" }
  | { ok: false; reason: "order_not_found" };

/**
 * Single idempotent entry point for a paid platform order (C5 unifies
 * subscriptions and wallet top-ups here). Concurrency-safe: the
 * `updateMany ... where status = CREATED` is an ATOMIC CLAIM — only the first
 * caller flips CREATED→PAID and runs the side effect; any later/duplicate call
 * (the verify callback racing the webhook, or a webhook redelivery) sees 0 rows
 * claimed and no-ops. The side effect runs in the SAME transaction as the claim,
 * so the order, the subscription/wallet, and the ledger move together or not at
 * all.
 *
 * Dispatch is by the order's server-trusted `purpose`:
 *  - SUBSCRIPTION → extend the plan period (from max(now, currentPeriodEnd) so
 *    early renewals stack rather than truncate).
 *  - WALLET_TOPUP → credit the prepaid wallet and append a ledger row.
 */
export async function markPlatformOrderPaid(input: {
  razorpayOrderId: string;
  razorpayPaymentId?: string | null;
}): Promise<PaidOrderResult> {
  return prisma.$transaction(async (tx) => {
    const now = new Date();

    const claim = await tx.platformOrder.updateMany({
      where: { razorpayOrderId: input.razorpayOrderId, status: "CREATED" },
      data: {
        status: "PAID",
        paidAt: now,
        razorpayPaymentId: input.razorpayPaymentId ?? null,
      },
    });

    const order = await tx.platformOrder.findUnique({
      where: { razorpayOrderId: input.razorpayOrderId },
    });

    if (claim.count === 0) {
      // Either already processed (idempotent no-op) or the order is unknown.
      return order
        ? { ok: true, alreadyProcessed: true, purpose: order.purpose }
        : { ok: false, reason: "order_not_found" };
    }

    // We won the claim — `order` is the server-trusted record. Run the effect.
    if (!order) return { ok: false, reason: "order_not_found" };

    if (order.purpose === "WALLET_TOPUP") {
      const wallet = await tx.wallet.upsert({
        where: { tenantId: order.tenantId },
        create: { tenantId: order.tenantId, balancePaise: order.amountPaise },
        update: { balancePaise: { increment: order.amountPaise } },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          tenantId: order.tenantId,
          direction: "CREDIT",
          amountPaise: order.amountPaise,
          balanceAfter: wallet.balancePaise,
          reason: "Wallet top-up",
          referenceType: "platform_order",
          referenceId: order.id,
        },
      });
      // A top-up clears any outstanding commission arrears (C7), oldest first.
      await settleDueCommissions(tx, order.tenantId);
      return { ok: true, alreadyProcessed: false, purpose: "WALLET_TOPUP" };
    }

    // SUBSCRIPTION — planId/billingCycle are always set for this purpose.
    if (!order.planId || !order.billingCycle) {
      throw new Error(`Subscription order ${order.id} missing plan/cycle`);
    }
    const sub = await tx.subscription.findUnique({
      where: { tenantId: order.tenantId },
      select: { currentPeriodEnd: true },
    });
    const base =
      sub?.currentPeriodEnd && sub.currentPeriodEnd > now
        ? sub.currentPeriodEnd
        : now;
    const currentPeriodEnd = addCycle(base, order.billingCycle);

    await tx.subscription.upsert({
      where: { tenantId: order.tenantId },
      create: {
        tenantId: order.tenantId,
        planId: order.planId,
        billingCycle: order.billingCycle,
        status: "ACTIVE",
        currentPeriodEnd,
      },
      update: {
        planId: order.planId,
        billingCycle: order.billingCycle,
        status: "ACTIVE",
        currentPeriodEnd,
      },
    });

    return { ok: true, alreadyProcessed: false, purpose: "SUBSCRIPTION" };
  });
}

/**
 * Activate a free (₹0) plan with no gateway round-trip. Perpetual (no period
 * end) until the seller changes plans. Idempotent via upsert.
 */
export function activateFreePlan(input: {
  tenantId: string;
  planId: string;
  billingCycle: "MONTHLY" | "YEARLY";
}) {
  return prisma.subscription.upsert({
    where: { tenantId: input.tenantId },
    create: {
      tenantId: input.tenantId,
      planId: input.planId,
      billingCycle: input.billingCycle,
      status: "ACTIVE",
      currentPeriodEnd: null,
    },
    update: {
      planId: input.planId,
      billingCycle: input.billingCycle,
      status: "ACTIVE",
      currentPeriodEnd: null,
    },
  });
}

/**
 * Claim a webhook event for processing (Phase 1.5, retry-safe). Upserts by the
 * unique `eventId`: records it on first delivery, bumps `attempts` on a redelivery.
 * Returns `alreadyProcessed: true` only when a PRIOR delivery COMPLETED
 * successfully (processedAt set) — so a redelivery of an event that was recorded
 * but failed mid-processing is NOT skipped; it gets reprocessed (the handler is
 * idempotent). The caller marks it processed on success.
 */
export async function claimPaymentEvent(input: {
  eventId: string;
  type: string;
  tenantId?: string | null;
  payload: Prisma.InputJsonValue;
}): Promise<{ alreadyProcessed: boolean }> {
  const ev = await prisma.paymentEvent.upsert({
    where: { eventId: input.eventId },
    create: {
      eventId: input.eventId,
      type: input.type,
      tenantId: input.tenantId ?? null,
      payload: input.payload,
      attempts: 1,
    },
    update: { attempts: { increment: 1 } },
    select: { processedAt: true },
  });
  return { alreadyProcessed: ev.processedAt !== null };
}

/** Mark a webhook event successfully handled (clears any prior error). */
export function markPaymentEventProcessed(eventId: string) {
  return prisma.paymentEvent.update({
    where: { eventId },
    data: { processedAt: new Date(), lastError: null },
  });
}

/** Record why processing an event failed (kept for the retry sweep + admin). */
export function recordPaymentEventError(eventId: string, error: string) {
  return prisma.paymentEvent.update({
    where: { eventId },
    data: { lastError: error.slice(0, 500) },
  });
}

/** Count webhook events still unprocessed after `olderThanMinutes` (monitor). */
export function countUnprocessedEvents(olderThanMinutes = 10) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
  return prisma.paymentEvent.count({
    where: { processedAt: null, createdAt: { lt: cutoff } },
  });
}
