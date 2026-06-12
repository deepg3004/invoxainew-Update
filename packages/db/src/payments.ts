import { Prisma } from "@prisma/client";
import { prisma } from "./client";

/**
 * Buyer payments + commission (C7).
 *
 * MONEY MODEL (hard rule): a buyer pays on the SELLER's gateway, so the full
 * amount settles seller-direct and never touches InvoxAI. InvoxAI's commission
 * is taken from the seller's prepaid WALLET — never from the buyer's money. If
 * the wallet can't cover it, the commission is recorded DUE and settled on the
 * next top-up (see settleDueCommissions).
 *
 * Idempotency: the PAID transition is an atomic claim on `razorpayOrderId`, and
 * the commission row is created only by the claim winner, so a refreshed
 * callback never double-records a payment or double-charges commission. Tenant
 * isolation: management reads/writes are scoped by the seller's tenantId; the
 * buyer order is only ever created on the resolving tenant's own gateway.
 */

// ── Payment pages (seller-managed) ───────────────────────────────────────────

export type CreatePageResult =
  | { ok: true; id: string }
  | { ok: false; reason: "slug_taken" };

export async function createPaymentPage(input: {
  tenantId: string;
  slug: string;
  title: string;
  description?: string | null;
  amountPaise: number;
}): Promise<CreatePageResult> {
  try {
    const page = await prisma.paymentPage.create({
      data: {
        tenantId: input.tenantId,
        slug: input.slug,
        title: input.title,
        description: input.description ?? null,
        amountPaise: input.amountPaise,
      },
      select: { id: true },
    });
    return { ok: true, id: page.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, reason: "slug_taken" };
    }
    throw e;
  }
}

/** A seller's pages, newest first. Scoped by tenantId. */
export function listPaymentPages(tenantId: string) {
  return prisma.paymentPage.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });
}

/** A page owned by this tenant (seller scope). */
export function getPaymentPageById(tenantId: string, id: string) {
  return prisma.paymentPage.findFirst({ where: { id, tenantId } });
}

/** An ACTIVE page by tenant+slug — the buyer-facing public lookup. */
export function getActivePaymentPage(tenantId: string, slug: string) {
  return prisma.paymentPage.findFirst({
    where: { tenantId, slug, isActive: true },
  });
}

/** An ACTIVE page by id — used by the buyer checkout action (amount is taken
 *  from here, server-trusted, never from the client). */
export function getActivePaymentPageById(id: string) {
  return prisma.paymentPage.findFirst({ where: { id, isActive: true } });
}

export function updatePaymentPage(
  tenantId: string,
  id: string,
  data: { title: string; description?: string | null; amountPaise: number },
) {
  // Scope the update to the owner via updateMany (where includes tenantId).
  return prisma.paymentPage.updateMany({
    where: { id, tenantId },
    data: {
      title: data.title,
      description: data.description ?? null,
      amountPaise: data.amountPaise,
    },
  });
}

export function setPaymentPageActive(
  tenantId: string,
  id: string,
  isActive: boolean,
) {
  return prisma.paymentPage.updateMany({
    where: { id, tenantId },
    data: { isActive },
  });
}

// ── Commission rate ──────────────────────────────────────────────────────────

/**
 * The commission rate (basis points) for a tenant: their active plan's rate,
 * falling back to the Free plan's rate (then 0) when unsubscribed. Reads through
 * a provided tx when settling inside a transaction.
 */
async function commissionBpsForTenant(
  client: Prisma.TransactionClient | typeof prisma,
  tenantId: string,
): Promise<number> {
  const sub = await client.subscription.findUnique({
    where: { tenantId },
    include: { plan: { select: { commissionBps: true } } },
  });
  if (sub) return sub.plan.commissionBps;
  const free = await client.plan.findUnique({
    where: { key: "free" },
    select: { commissionBps: true },
  });
  return free?.commissionBps ?? 0;
}

export function getCommissionBpsForTenant(tenantId: string) {
  return commissionBpsForTenant(prisma, tenantId);
}

// ── Buyer payments ───────────────────────────────────────────────────────────

/**
 * Create a pending buyer order against EITHER a payment page (C7) or a store
 * product (Store slice 2). Exactly one of paymentPageId/productId must be set;
 * `itemTitle` snapshots the name so order history is source-independent.
 */
export function createBuyerPayment(input: {
  razorpayOrderId: string;
  tenantId: string;
  paymentPageId?: string | null;
  productId?: string | null;
  courseId?: string | null;
  quantity?: number;
  itemTitle: string;
  amountPaise: number;
  couponId?: string | null;
  couponCode?: string | null;
  discountPaise?: number;
  buyerProfileId?: string | null;
  buyerEmail?: string | null;
  buyerContact?: string | null;
}) {
  return prisma.buyerPayment.create({
    data: {
      razorpayOrderId: input.razorpayOrderId,
      tenantId: input.tenantId,
      paymentPageId: input.paymentPageId ?? null,
      productId: input.productId ?? null,
      courseId: input.courseId ?? null,
      quantity: input.quantity ?? 1,
      itemTitle: input.itemTitle,
      // amountPaise is the POST-discount charged total (server-trusted).
      amountPaise: input.amountPaise,
      couponId: input.couponId ?? null,
      couponCode: input.couponCode ?? null,
      discountPaise: input.discountPaise ?? 0,
      buyerProfileId: input.buyerProfileId ?? null,
      buyerEmail: input.buyerEmail ?? null,
      buyerContact: input.buyerContact ?? null,
    },
    select: { id: true, razorpayOrderId: true },
  });
}

export function getBuyerPaymentByOrderId(razorpayOrderId: string) {
  return prisma.buyerPayment.findUnique({
    where: { razorpayOrderId },
    include: { paymentPage: true },
  });
}

/**
 * Create a pending multi-item (cart) order — Store slice 3. ONE BuyerPayment
 * (productId null, the payment/commission/fulfillment record) plus one OrderItem
 * per line, in a single transaction. `amountPaise` is the server-trusted total
 * (sum of unitPricePaise×quantity); `itemTitle` is a human summary so existing
 * order displays render uniformly without reading the lines. Same money rail as
 * single-item: the Razorpay order was created on the SELLER's gateway upstream.
 */
export function createCartOrder(input: {
  razorpayOrderId: string;
  tenantId: string;
  amountPaise: number;
  itemTitle: string;
  items: {
    productId: string;
    titleSnapshot: string;
    unitPricePaise: number;
    quantity: number;
  }[];
  couponId?: string | null;
  couponCode?: string | null;
  discountPaise?: number;
  buyerProfileId?: string | null;
  buyerEmail?: string | null;
  buyerContact?: string | null;
}) {
  return prisma.buyerPayment.create({
    data: {
      razorpayOrderId: input.razorpayOrderId,
      tenantId: input.tenantId,
      // Cart orders are multi-product, so no single productId; lines carry it.
      productId: null,
      itemTitle: input.itemTitle,
      // POST-discount charged total; the lines carry the pre-discount unit prices.
      amountPaise: input.amountPaise,
      couponId: input.couponId ?? null,
      couponCode: input.couponCode ?? null,
      discountPaise: input.discountPaise ?? 0,
      buyerProfileId: input.buyerProfileId ?? null,
      buyerEmail: input.buyerEmail ?? null,
      buyerContact: input.buyerContact ?? null,
      orderItems: {
        create: input.items.map((it) => ({
          productId: it.productId,
          titleSnapshot: it.titleSnapshot,
          unitPricePaise: it.unitPricePaise,
          quantity: it.quantity,
        })),
      },
    },
    select: { id: true, razorpayOrderId: true },
  });
}

// ── Order tracking (C10) ──────────────────────────────────────────────────────

/** A seller's paid orders, newest first, with item + commission. Scoped. An
 *  optional fulfillmentStatus narrows the list (for the seller's status filter). */
export function listTenantOrders(
  tenantId: string,
  fulfillmentStatus?: "NEW" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED",
  take = 100,
) {
  return prisma.buyerPayment.findMany({
    where: { tenantId, status: "PAID", ...(fulfillmentStatus ? { fulfillmentStatus } : {}) },
    orderBy: { paidAt: "desc" },
    take,
    include: {
      paymentPage: { select: { title: true, slug: true } },
      commission: { select: { status: true, amountPaise: true } },
      orderItems: {
        select: { titleSnapshot: true, unitPricePaise: true, quantity: true },
      },
    },
  });
}

export interface SalesSummary {
  orderCount: number;
  grossPaise: number;
  commissionPaidPaise: number;
  commissionDuePaise: number;
}

/** Headline sales totals for the seller's orders dashboard. Scoped by tenantId. */
export async function getTenantSalesSummary(tenantId: string): Promise<SalesSummary> {
  const [orders, commissions] = await Promise.all([
    prisma.buyerPayment.aggregate({
      where: { tenantId, status: "PAID" },
      _count: { _all: true },
      _sum: { amountPaise: true },
    }),
    prisma.commissionCharge.groupBy({
      by: ["status"],
      where: { tenantId },
      _sum: { amountPaise: true },
    }),
  ]);
  const paid = commissions.find((c) => c.status === "PAID")?._sum.amountPaise ?? 0;
  const due = commissions.find((c) => c.status === "DUE")?._sum.amountPaise ?? 0;
  return {
    orderCount: orders._count._all,
    grossPaise: orders._sum.amountPaise ?? 0,
    commissionPaidPaise: paid,
    commissionDuePaise: due,
  };
}

// ── Refunds (Phase 1) ─────────────────────────────────────────────────────────

/** A seller's own PAID order, with the fields needed to issue a refund. Scoped. */
export function getRefundableOrder(tenantId: string, id: string) {
  return prisma.buyerPayment.findFirst({
    where: { id, tenantId, status: "PAID" },
    select: {
      id: true,
      razorpayPaymentId: true,
      amountPaise: true,
      refundedPaise: true,
    },
  });
}

export type RefundResult =
  | {
      ok: true;
      alreadyProcessed: boolean;
      commissionReversedPaise: number;
    }
  | { ok: false; reason: "not_found" | "not_refundable" | "amount_invalid" };

/**
 * Record a refund (already executed on the SELLER's gateway) and reverse the
 * proportional commission — in ONE transaction, idempotently.
 *
 * Commission reversal: refundCommission = commission × refundAmount / orderAmount.
 *  - commission was PAID (debited from wallet) → CREDIT it back to the wallet.
 *  - commission was DUE (not yet collected) → reduce the outstanding DUE amount.
 * `razorpayRefundId` is unique, so a retried/duplicate record is a no-op. Partial
 * refunds accumulate in `refundedPaise`; we never reverse more commission than
 * was charged. Never touches buyer money — only the seller's wallet/arrears.
 */
export async function recordRefund(input: {
  buyerPaymentId: string;
  tenantId: string;
  razorpayRefundId: string;
  amountPaise: number;
}): Promise<RefundResult> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.refund.findUnique({
      where: { razorpayRefundId: input.razorpayRefundId },
      select: { commissionReversedPaise: true },
    });
    if (existing) {
      return {
        ok: true,
        alreadyProcessed: true,
        commissionReversedPaise: existing.commissionReversedPaise,
      };
    }

    const order = await tx.buyerPayment.findFirst({
      where: { id: input.buyerPaymentId, tenantId: input.tenantId },
      include: { commission: true },
    });
    if (!order) return { ok: false, reason: "not_found" };
    if (order.status !== "PAID") return { ok: false, reason: "not_refundable" };

    const remaining = order.amountPaise - order.refundedPaise;
    if (input.amountPaise <= 0 || input.amountPaise > remaining) {
      return { ok: false, reason: "amount_invalid" };
    }

    // Proportional commission reversal.
    let commissionReversed = 0;
    if (order.commission && order.amountPaise > 0) {
      commissionReversed = Math.floor(
        (order.commission.amountPaise * input.amountPaise) / order.amountPaise,
      );
      if (commissionReversed > 0) {
        if (order.commission.status === "PAID") {
          const wallet = await tx.wallet.upsert({
            where: { tenantId: input.tenantId },
            create: { tenantId: input.tenantId, balancePaise: commissionReversed },
            update: { balancePaise: { increment: commissionReversed } },
          });
          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              tenantId: input.tenantId,
              direction: "CREDIT",
              amountPaise: commissionReversed,
              balanceAfter: wallet.balancePaise,
              reason: "Commission refund",
              referenceType: "refund",
              referenceId: input.razorpayRefundId,
            },
          });
        } else {
          // DUE — reduce what the seller still owes (floor at 0).
          await tx.commissionCharge.update({
            where: { id: order.commission.id },
            data: {
              amountPaise: Math.max(0, order.commission.amountPaise - commissionReversed),
            },
          });
        }
      }
    }

    await tx.buyerPayment.update({
      where: { id: order.id },
      data: { refundedPaise: order.refundedPaise + input.amountPaise },
    });
    await tx.refund.create({
      data: {
        razorpayRefundId: input.razorpayRefundId,
        buyerPaymentId: order.id,
        tenantId: input.tenantId,
        amountPaise: input.amountPaise,
        commissionReversedPaise: commissionReversed,
      },
    });

    return { ok: true, alreadyProcessed: false, commissionReversedPaise: commissionReversed };
  });
}

/** Update a seller's own order fulfillment status + tracking note. Scoped. */
export function updateOrderFulfillment(
  tenantId: string,
  id: string,
  status: "NEW" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED",
  trackingNote: string | null,
) {
  return prisma.buyerPayment.updateMany({
    where: { id, tenantId },
    data: { fulfillmentStatus: status, trackingNote },
  });
}

export type BuyerPaidResult =
  | { ok: true; alreadyProcessed: boolean; commission: "paid" | "due" | "none" }
  | { ok: false; reason: "not_found" };

/**
 * Mark a buyer payment PAID and charge the seller's commission — idempotently.
 *
 * The atomic CREATED→PAID claim guarantees the commission is computed and
 * charged at most once. Commission is debited from the seller's wallet if it can
 * cover it (CommissionCharge PAID + wallet DEBIT), otherwise recorded DUE. The
 * buyer payment itself ALWAYS succeeds regardless — the buyer's money already
 * settled to the seller; commission is purely a seller-wallet matter.
 */
export async function markBuyerPaymentPaid(input: {
  razorpayOrderId: string;
  razorpayPaymentId?: string | null;
}): Promise<BuyerPaidResult> {
  return prisma.$transaction(async (tx) => {
    const now = new Date();

    const claim = await tx.buyerPayment.updateMany({
      where: { razorpayOrderId: input.razorpayOrderId, status: "CREATED" },
      data: {
        status: "PAID",
        paidAt: now,
        razorpayPaymentId: input.razorpayPaymentId ?? null,
      },
    });

    const payment = await tx.buyerPayment.findUnique({
      where: { razorpayOrderId: input.razorpayOrderId },
    });
    if (claim.count === 0) {
      return payment
        ? { ok: true, alreadyProcessed: true, commission: "none" }
        : { ok: false, reason: "not_found" };
    }
    if (!payment) return { ok: false, reason: "not_found" };

    // Decrement tracked stock for product orders (the claim winner only, so it
    // can't double-decrement on a refreshed callback). Stock is reduced at PAID
    // — the safe point, since only paid orders consume stock. Clamped at 0; a
    // rare concurrent-oversell can't drive it negative.
    //
    // Two mutually-exclusive sources: a multi-item CART order carries OrderItem
    // lines (productId on the payment is null), while a single-product quick-buy
    // (Store slice 2) carries productId/quantity directly. We drive off the
    // lines when present, else the legacy single-product field — never both, so
    // no order is decremented twice.
    const lines = await tx.orderItem.findMany({
      where: { buyerPaymentId: payment.id, productId: { not: null } },
      select: { productId: true, quantity: true },
    });
    const stockToDecrement =
      lines.length > 0
        ? lines.map((l) => ({ productId: l.productId as string, quantity: l.quantity }))
        : payment.productId
          ? [{ productId: payment.productId, quantity: payment.quantity }]
          : [];
    for (const { productId, quantity } of stockToDecrement) {
      await tx.product.updateMany({
        where: { id: productId, stockQty: { not: null } },
        data: { stockQty: { decrement: quantity } },
      });
      await tx.product.updateMany({
        where: { id: productId, stockQty: { lt: 0 } },
        data: { stockQty: 0 },
      });
    }

    // Count the coupon redemption — claim-winner only, so a replayed webhook
    // can't double-count. Conditional on the cap so we never push redeemedCount
    // past maxRedemptions; if the cap was just reached by a concurrent order,
    // this buyer's already-honored discount simply isn't counted (accepted
    // over-redemption window, same as stock). Discount is baked into amountPaise,
    // so commission below is already on the discounted total.
    if (payment.couponId) {
      await tx.coupon.updateMany({
        where: {
          id: payment.couponId,
          OR: [
            { maxRedemptions: null },
            { redeemedCount: { lt: prisma.coupon.fields.maxRedemptions } },
          ],
        },
        data: { redeemedCount: { increment: 1 } },
      });
    }

    // Courses / LMS: grant the buyer's enrolment for a course order. Claim-winner
    // only (so a replay can't double-grant); buyerPaymentId is unique as a second
    // guard. Attribution mirrors the order (profileId when logged in, else email),
    // so a guest purchase unlocks access once they sign in with the same email.
    if (payment.courseId) {
      await tx.enrolment.create({
        data: {
          tenantId: payment.tenantId,
          courseId: payment.courseId,
          buyerProfileId: payment.buyerProfileId,
          buyerEmail: payment.buyerEmail,
          buyerPaymentId: payment.id,
        },
      });
    }

    const bps = await commissionBpsForTenant(tx, payment.tenantId);
    const commissionPaise = Math.floor((payment.amountPaise * bps) / 10000);
    if (commissionPaise <= 0) {
      return { ok: true, alreadyProcessed: false, commission: "none" };
    }

    const wallet = await tx.wallet.findUnique({
      where: { tenantId: payment.tenantId },
    });
    const canCover = wallet && wallet.balancePaise >= commissionPaise;

    if (wallet && canCover) {
      const balanceAfter = wallet.balancePaise - commissionPaise;
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balancePaise: balanceAfter },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          tenantId: payment.tenantId,
          direction: "DEBIT",
          amountPaise: commissionPaise,
          balanceAfter,
          reason: "Commission on sale",
          referenceType: "commission",
          referenceId: `commission_${payment.id}`,
        },
      });
    }

    await tx.commissionCharge.create({
      data: {
        buyerPaymentId: payment.id,
        tenantId: payment.tenantId,
        amountPaise: commissionPaise,
        bps,
        status: canCover ? "PAID" : "DUE",
        settledAt: canCover ? now : null,
      },
    });

    return {
      ok: true,
      alreadyProcessed: false,
      commission: canCover ? "paid" : "due",
    };
  });
}

/**
 * Settle outstanding DUE commission, oldest first, while the wallet can cover
 * each charge. Runs INSIDE the top-up transaction (see markPlatformOrderPaid),
 * so a top-up automatically clears arrears. Each settlement debit reuses the
 * stable `commission_<buyerPaymentId>` reference, so it can't double-apply.
 */
export async function settleDueCommissions(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<void> {
  const wallet = await tx.wallet.findUnique({ where: { tenantId } });
  if (!wallet) return;

  const due = await tx.commissionCharge.findMany({
    where: { tenantId, status: "DUE" },
    orderBy: { createdAt: "asc" },
  });

  let balance = wallet.balancePaise;
  const now = new Date();
  for (const charge of due) {
    if (balance < charge.amountPaise) break; // oldest-first; stop when short
    balance -= charge.amountPaise;
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balancePaise: balance },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        tenantId,
        direction: "DEBIT",
        amountPaise: charge.amountPaise,
        balanceAfter: balance,
        reason: "Commission settlement",
        referenceType: "commission",
        referenceId: `commission_${charge.buyerPaymentId}`,
      },
    });
    await tx.commissionCharge.update({
      where: { id: charge.id },
      data: { status: "PAID", settledAt: now },
    });
  }
}
