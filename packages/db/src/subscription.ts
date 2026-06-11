import { Prisma } from "@prisma/client";
import { prisma } from "./client";

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

/** Record a checkout order created against the platform gateway. */
export function createPlatformOrder(input: {
  razorpayOrderId: string;
  tenantId: string;
  planId: string;
  billingCycle: "MONTHLY" | "YEARLY";
  amountPaise: number;
}) {
  return prisma.platformOrder.create({
    data: {
      razorpayOrderId: input.razorpayOrderId,
      tenantId: input.tenantId,
      planId: input.planId,
      billingCycle: input.billingCycle,
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

export type ActivateResult =
  | { ok: true; alreadyProcessed: boolean }
  | { ok: false; reason: "order_not_found" };

/**
 * Mark a paid order processed and activate/extend the tenant's subscription.
 * IDEMPOTENT and concurrency-safe: the `updateMany ... where status = CREATED`
 * is an atomic claim — only the first caller flips CREATED→PAID and proceeds to
 * extend the period; any later/duplicate call sees 0 rows claimed and no-ops.
 * So the verify callback and the webhook can both call this freely.
 *
 * The new period extends from the later of "now" or the current period end, so
 * an early renewal stacks time rather than truncating it.
 */
export async function markOrderPaidAndActivate(input: {
  razorpayOrderId: string;
  razorpayPaymentId?: string | null;
}): Promise<ActivateResult> {
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

    if (claim.count === 0) {
      // Either already processed (idempotent no-op) or the order is unknown.
      const existing = await tx.platformOrder.findUnique({
        where: { razorpayOrderId: input.razorpayOrderId },
        select: { id: true },
      });
      return existing
        ? { ok: true, alreadyProcessed: true }
        : { ok: false, reason: "order_not_found" };
    }

    // We won the claim — load the (server-trusted) order and activate.
    const order = await tx.platformOrder.findUniqueOrThrow({
      where: { razorpayOrderId: input.razorpayOrderId },
    });

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

    return { ok: true, alreadyProcessed: false };
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
 * Record a webhook event for idempotency + audit. Returns `isNew: false` when
 * this `eventId` was already stored (duplicate delivery), so the caller skips
 * reprocessing. The unique constraint on `eventId` is the dedup boundary.
 */
export async function recordPaymentEvent(input: {
  eventId: string;
  type: string;
  tenantId?: string | null;
  payload: Prisma.InputJsonValue;
}): Promise<{ isNew: boolean }> {
  try {
    await prisma.paymentEvent.create({
      data: {
        eventId: input.eventId,
        type: input.type,
        tenantId: input.tenantId ?? null,
        payload: input.payload,
      },
    });
    return { isNew: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { isNew: false };
    }
    throw e;
  }
}
