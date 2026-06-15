import { Prisma, type BuyerPayment, type ProductKind } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "./client";
import { getUpiDueBlockPaise } from "./settings";
import { lockWalletForUpdate } from "./wallet";

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
  compareAtPaise?: number | null;
  imageUrl?: string | null;
  accessUrl?: string | null;
  kind?: ProductKind;
}): Promise<CreatePageResult> {
  try {
    const page = await prisma.paymentPage.create({
      data: {
        tenantId: input.tenantId,
        slug: input.slug,
        title: input.title,
        description: input.description ?? null,
        amountPaise: input.amountPaise,
        compareAtPaise: input.compareAtPaise ?? null,
        imageUrl: input.imageUrl ?? null,
        accessUrl: input.accessUrl ?? null,
        kind: input.kind ?? "DIGITAL",
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
export function listPaymentPages(tenantId: string, opts: { skip?: number; take?: number } = {}) {
  return prisma.paymentPage.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    skip: opts.skip,
    take: opts.take,
  });
}

export function countPaymentPages(tenantId: string) {
  return prisma.paymentPage.count({ where: { tenantId } });
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
  data: {
    title: string;
    description?: string | null;
    amountPaise: number;
    compareAtPaise?: number | null;
    imageUrl?: string | null;
    accessUrl?: string | null;
    kind?: ProductKind;
  },
) {
  // Scope the update to the owner via updateMany (where includes tenantId).
  return prisma.paymentPage.updateMany({
    where: { id, tenantId },
    data: {
      title: data.title,
      description: data.description ?? null,
      amountPaise: data.amountPaise,
      compareAtPaise: data.compareAtPaise ?? null,
      imageUrl: data.imageUrl ?? null,
      accessUrl: data.accessUrl ?? null,
      kind: data.kind ?? "DIGITAL",
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
/** Campaign attribution captured on landing, stamped onto the order at checkout. */
export interface UtmFields {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  content?: string | null;
  term?: string | null;
}

function utmData(u?: UtmFields | null) {
  return {
    utmSource: u?.source ?? null,
    utmMedium: u?.medium ?? null,
    utmCampaign: u?.campaign ?? null,
    utmContent: u?.content ?? null,
    utmTerm: u?.term ?? null,
  };
}

/** Affiliate attribution stamped on an order. Resolved server-side (see
 * resolveAffiliateAttribution in affiliates.ts); all-null/zero when the order
 * carries no valid affiliate ref. The commission is a RECORDED figure the seller
 * owes the affiliate — it never changes the buyer charge or InvoxAI commission. */
export interface AffiliateFields {
  affiliateId?: string | null;
  affiliateCode?: string | null;
  affiliateCommissionPaise?: number;
}

function affiliateData(a?: AffiliateFields | null) {
  return {
    affiliateId: a?.affiliateId ?? null,
    affiliateCode: a?.affiliateCode ?? null,
    affiliateCommissionPaise: a?.affiliateCommissionPaise ?? 0,
  };
}

export function createBuyerPayment(input: {
  razorpayOrderId: string;
  tenantId: string;
  paymentPageId?: string | null;
  productId?: string | null;
  courseId?: string | null;
  communityId?: string | null;
  workshopId?: string | null;
  quantity?: number;
  itemTitle: string;
  amountPaise: number;
  couponId?: string | null;
  couponCode?: string | null;
  discountPaise?: number;
  buyerProfileId?: string | null;
  buyerEmail?: string | null;
  buyerContact?: string | null;
  utm?: UtmFields | null;
  affiliate?: AffiliateFields | null;
  // Manual UPI: status PENDING + method/ref. Defaults keep the Razorpay path
  // (CREATED, RAZORPAY) byte-identical to before.
  status?: "CREATED" | "PENDING";
  paymentMethod?: "RAZORPAY" | "UPI_MANUAL";
  upiRef?: string | null;
  // Growth G1.1 (OTO): set when this order is a post-purchase one-time offer, linking
  // it to the parent order + the accepted upsell. The (parent, upsell) unique makes
  // acceptance idempotent. Both null for every normal order.
  parentPaymentId?: string | null;
  upsellId?: string | null;
}) {
  return prisma.buyerPayment.create({
    data: {
      razorpayOrderId: input.razorpayOrderId,
      tenantId: input.tenantId,
      paymentPageId: input.paymentPageId ?? null,
      productId: input.productId ?? null,
      parentPaymentId: input.parentPaymentId ?? null,
      upsellId: input.upsellId ?? null,
      courseId: input.courseId ?? null,
      communityId: input.communityId ?? null,
      workshopId: input.workshopId ?? null,
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
      status: input.status ?? "CREATED",
      paymentMethod: input.paymentMethod ?? "RAZORPAY",
      upiRef: input.upiRef ?? null,
      ...utmData(input.utm),
      ...affiliateData(input.affiliate),
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
  utm?: UtmFields | null;
  affiliate?: AffiliateFields | null;
  // Manual UPI: same defaults as createBuyerPayment — a Razorpay cart order is
  // CREATED/RAZORPAY (byte-identical to before); a manual-UPI cart order is
  // PENDING/UPI_MANUAL and carries the buyer-submitted reference.
  status?: "CREATED" | "PENDING";
  paymentMethod?: "RAZORPAY" | "UPI_MANUAL";
  upiRef?: string | null;
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
      status: input.status ?? "CREATED",
      paymentMethod: input.paymentMethod ?? "RAZORPAY",
      upiRef: input.upiRef ?? null,
      ...utmData(input.utm),
      ...affiliateData(input.affiliate),
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

/**
 * Products referenced by an order that are now at ZERO tracked stock — for the
 * seller's out-of-stock alert. Call AFTER markBuyerPaymentPaid (which decrements
 * stock). Covers both a single-product order and a multi-item cart; untracked
 * (null stock) products are never included. Tenant scope is implied by the order.
 */
export async function listSoldOutProductsForOrder(buyerPaymentId: string) {
  const payment = await prisma.buyerPayment.findUnique({
    where: { id: buyerPaymentId },
    select: {
      productId: true,
      orderItems: { select: { productId: true } },
    },
  });
  if (!payment) return [];
  const ids =
    payment.orderItems.length > 0
      ? payment.orderItems.map((l) => l.productId).filter((x): x is string => x !== null)
      : payment.productId
        ? [payment.productId]
        : [];
  if (ids.length === 0) return [];
  return prisma.product.findMany({
    where: { id: { in: ids }, stockQty: 0 },
    select: { id: true, title: true },
  });
}

// ── Order tracking (C10) ──────────────────────────────────────────────────────

export type FulfillmentStatusFilter =
  | "NEW"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

export interface OrderListOpts {
  /** Narrow to a single fulfillment status (the seller's status tabs). */
  status?: FulfillmentStatusFilter;
  /** Free-text search over buyer email/phone, item title, payment id, page title. */
  search?: string;
  /** Pagination offset and page size. */
  skip?: number;
  take?: number;
}

/**
 * Shared WHERE for a seller's PAID orders. `tenantId` and `status:"PAID"` are
 * always AND-ed at the TOP level, so the optional search `OR`-clause can never
 * widen the result beyond THIS tenant's own paid orders — a search/filter can't
 * cross tenants. Search is case-insensitive across the buyer-identifying fields.
 */
function tenantOrdersWhere(
  tenantId: string,
  opts: OrderListOpts = {},
): Prisma.BuyerPaymentWhereInput {
  const q = opts.search?.trim();
  return {
    tenantId,
    status: "PAID",
    ...(opts.status ? { fulfillmentStatus: opts.status } : {}),
    ...(q
      ? {
          OR: [
            { buyerEmail: { contains: q, mode: "insensitive" } },
            { buyerContact: { contains: q, mode: "insensitive" } },
            { itemTitle: { contains: q, mode: "insensitive" } },
            { razorpayPaymentId: { contains: q, mode: "insensitive" } },
            { paymentPage: { is: { title: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
}

/** A seller's paid orders, newest first, with item + commission. Scoped.
 *  Optional status / search filters + skip/take pagination (default take 100). */
export function listTenantOrders(tenantId: string, opts: OrderListOpts = {}) {
  return prisma.buyerPayment.findMany({
    where: tenantOrdersWhere(tenantId, opts),
    orderBy: { paidAt: "desc" },
    skip: opts.skip,
    take: opts.take ?? 100,
    include: {
      paymentPage: { select: { title: true, slug: true } },
      commission: { select: { status: true, amountPaise: true } },
      orderItems: {
        select: { titleSnapshot: true, unitPricePaise: true, quantity: true },
      },
    },
  });
}

/** Total paid orders matching the same status/search filter (drives pagination).
 *  Scoped — identical WHERE to listTenantOrders. */
export function countTenantOrders(tenantId: string, opts: OrderListOpts = {}) {
  return prisma.buyerPayment.count({ where: tenantOrdersWhere(tenantId, opts) });
}

/**
 * Manual-UPI orders awaiting the seller's manual confirmation: PENDING with a
 * buyer-submitted reference (upiRef set). This is the fallback queue — an order
 * only lands here when auto-confirm was off, the amount was above the seller's
 * cap, or the seller was dues-blocked. Unsubmitted sessions (upiRef null) are
 * not shown (they're live/expiring QR sessions, not awaiting a human). Scoped.
 */
export function listPendingUpiOrders(tenantId: string) {
  return prisma.buyerPayment.findMany({
    where: {
      tenantId,
      status: "PENDING",
      paymentMethod: "UPI_MANUAL",
      upiRef: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { paymentPage: { select: { title: true } } },
  });
}

/**
 * Started-but-unpaid checkouts (status CREATED) older than `olderThanMinutes`
 * (default 30) — i.e. abandoned carts/checkouts, excluding ones a buyer may
 * still be paying. The buyer's email/phone were captured at checkout, so the
 * seller can follow up manually (auto email/WhatsApp nudges come once an email
 * provider is configured). CREATED orders have no side effects — stock and
 * coupon redemptions only move on PAID — so this is purely informational.
 * Tenant-scoped; FAILED (hard decline) is intentionally excluded.
 */
export function listAbandonedCheckouts(
  tenantId: string,
  opts: { olderThanMinutes?: number; skip?: number; take?: number } = {},
) {
  const cutoff = new Date(Date.now() - (opts.olderThanMinutes ?? 30) * 60_000);
  return prisma.buyerPayment.findMany({
    where: { tenantId, status: "CREATED", createdAt: { lt: cutoff } },
    orderBy: { createdAt: "desc" },
    skip: opts.skip,
    take: opts.take ?? 100,
    include: {
      paymentPage: { select: { title: true, slug: true } },
      orderItems: { select: { titleSnapshot: true, quantity: true } },
    },
  });
}

/** Count of abandoned checkouts (for the dashboard badge). Same window/filter. */
export function countAbandonedCheckouts(
  tenantId: string,
  olderThanMinutes = 30,
) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
  return prisma.buyerPayment.count({
    where: { tenantId, status: "CREATED", createdAt: { lt: cutoff } },
  });
}

/**
 * Growth G1.2 — checkouts due an automatic recovery email (GLOBAL across tenants,
 * for the cron sweep). A row qualifies when it's a Razorpay checkout still CREATED
 * (manual-UPI has its own session/expiry flow), has a buyer email, hasn't been
 * nudged yet, and sits in the recovery WINDOW: older than `minAgeMinutes` (truly
 * abandoned, not still paying) but newer than `maxAgeHours` (a stale nudge is
 * pointless / spammy). Includes the bits needed to build the resume link + email.
 */
export function listCheckoutsForRecovery(opts: {
  minAgeMinutes?: number;
  maxAgeHours?: number;
  limit?: number;
}) {
  const now = Date.now();
  const newerThan = new Date(now - (opts.minAgeMinutes ?? 30) * 60_000);
  const olderThan = new Date(now - (opts.maxAgeHours ?? 24) * 3_600_000);
  return prisma.buyerPayment.findMany({
    where: {
      status: "CREATED",
      paymentMethod: "RAZORPAY",
      recoveryEmailAt: null,
      buyerEmail: { not: null },
      createdAt: { lte: newerThan, gte: olderThan },
    },
    orderBy: { createdAt: "asc" },
    take: opts.limit ?? 200,
    select: {
      id: true,
      tenantId: true,
      itemTitle: true,
      amountPaise: true,
      buyerEmail: true,
      paymentPage: { select: { slug: true } },
      product: { select: { slug: true } },
      tenant: {
        select: {
          username: true,
          name: true,
          domains: { where: { isPrimary: true }, select: { domain: true }, take: 1 },
        },
      },
    },
  });
}

/**
 * Atomically claim a checkout for its recovery email (set recoveryEmailAt where it's
 * still null). Returns true only for the winner, so two concurrent cron runs can
 * never double-send. Call this BEFORE sending; if it returns false, skip.
 */
export async function claimRecoveryEmail(id: string): Promise<boolean> {
  const res = await prisma.buyerPayment.updateMany({
    where: { id, recoveryEmailAt: null },
    data: { recoveryEmailAt: new Date() },
  });
  return res.count === 1;
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

/** Quick status-only advance (keeps the tracking note intact). Seller-scoped. */
export function setOrderFulfillmentStatus(
  tenantId: string,
  id: string,
  status: "NEW" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED",
) {
  return prisma.buyerPayment.updateMany({
    where: { id, tenantId },
    data: { fulfillmentStatus: status },
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

    return applyPaidEffects(tx, payment, now);
  });
}

/**
 * Post-PAID side-effects, shared by the Razorpay verify path (markBuyerPaymentPaid)
 * and the manual-UPI seller-confirm path (confirmManualBuyerPayment): decrement
 * stock, count the coupon redemption, grant course enrolment, and charge
 * commission from the wallet (or record it DUE). The caller has ALREADY atomically
 * claimed the order →PAID, so this runs exactly once per order (claim winner) and
 * is fully idempotent. Operates on the caller's transaction `tx`.
 */
async function applyPaidEffects(
  tx: Prisma.TransactionClient,
  payment: BuyerPayment,
  now: Date,
): Promise<BuyerPaidResult> {
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
    //
    // createMany(skipDuplicates) → INSERT … ON CONFLICT DO NOTHING: a concurrent
    // second purchase of the SAME course by the SAME buyer (which races past the
    // app-level getEnrolment check) hits the (course, profile)/(course, email)
    // partial unique indexes and is skipped — the buyer keeps a single enrolment,
    // and crucially this does NOT throw, so it can't abort/poison the payment
    // transaction (a plain create() would raise P2002 here and roll back the PAID
    // claim + commission). The double charge itself is gateway-side and out of
    // scope; the seller can refund the extra payment.
    if (payment.courseId) {
      await tx.enrolment.createMany({
        data: [
          {
            tenantId: payment.tenantId,
            courseId: payment.courseId,
            buyerProfileId: payment.buyerProfileId,
            buyerEmail: payment.buyerEmail,
            buyerPaymentId: payment.id,
          },
        ],
        skipDuplicates: true,
      });
    }

    // Phase 12: grant the buyer's community membership for a community order.
    // Identical guard to enrolments — claim-winner only + buyerPaymentId unique +
    // skipDuplicates (so a racing re-grant can't throw and poison the PAID claim).
    if (payment.communityId) {
      await tx.communityMembership.createMany({
        data: [
          {
            tenantId: payment.tenantId,
            communityId: payment.communityId,
            buyerProfileId: payment.buyerProfileId,
            buyerEmail: payment.buyerEmail,
            buyerPaymentId: payment.id,
            source: "paid",
          },
        ],
        skipDuplicates: true,
      });
    }

    // Grant the buyer's workshop registration for a workshop order. Identical
    // guard to enrolments/memberships — claim-winner only + buyerPaymentId unique
    // + skipDuplicates (so a racing re-grant can't throw and poison the PAID claim).
    if (payment.workshopId) {
      await tx.workshopRegistration.createMany({
        data: [
          {
            tenantId: payment.tenantId,
            workshopId: payment.workshopId,
            buyerProfileId: payment.buyerProfileId,
            buyerEmail: payment.buyerEmail,
            buyerPaymentId: payment.id,
            source: "paid",
          },
        ],
        skipDuplicates: true,
      });
    }

    const bps = await commissionBpsForTenant(tx, payment.tenantId);
    const commissionPaise = Math.floor((payment.amountPaise * bps) / 10000);
    if (commissionPaise <= 0) {
      return { ok: true, alreadyProcessed: false, commission: "none" };
    }

    // Lock the wallet row so this commission debit can't race another fee on the
    // same wallet (lost-update → money drift). Held until the surrounding tx commits.
    const wallet = await lockWalletForUpdate(tx, payment.tenantId);
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
}

/**
 * Atomically claim a PENDING order →PAID (scoped by tenant + id, so a forged id
 * can't touch another tenant's order and a double-tap can't double-charge), then
 * run the shared idempotent paid-effects (stock/coupon/enrolment/commission).
 * Operates on the caller's transaction. Shared by BOTH the manual seller-confirm
 * path (confirmManualBuyerPayment) and the buyer-triggered auto-confirm path
 * (autoConfirmOrHoldUpiOrder), so the exactly-once money logic can't drift.
 */
async function claimPendingAndApply(
  tx: Prisma.TransactionClient,
  tenantId: string,
  buyerPaymentId: string,
  now: Date,
): Promise<BuyerPaidResult> {
  const claim = await tx.buyerPayment.updateMany({
    where: { id: buyerPaymentId, tenantId, status: "PENDING" },
    data: { status: "PAID", paidAt: now },
  });
  const payment = await tx.buyerPayment.findFirst({
    where: { id: buyerPaymentId, tenantId },
  });
  if (claim.count === 0) {
    return payment
      ? { ok: true, alreadyProcessed: true, commission: "none" }
      : { ok: false, reason: "not_found" };
  }
  if (!payment) return { ok: false, reason: "not_found" };
  return applyPaidEffects(tx, payment, now);
}

/**
 * Manual-UPI: the SELLER confirms a buyer-submitted UPI payment (the dues-blocked
 * / auto-confirm-off fallback queue). Same exactly-once path as a Razorpay sale.
 * The buyer already paid the seller's UPI directly — InvoxAI never held the money;
 * this only records the sale + takes commission from the seller's wallet.
 */
export async function confirmManualBuyerPayment(
  tenantId: string,
  buyerPaymentId: string,
): Promise<BuyerPaidResult> {
  return prisma.$transaction((tx) =>
    claimPendingAndApply(tx, tenantId, buyerPaymentId, new Date()),
  );
}

// ── Manual-UPI auto-confirm sessions (unique-amount nonce + expiry) ────────────

/** Cart line shape for a multi-item UPI session (mirrors createCartOrder). */
type UpiSessionItem = {
  productId: string;
  titleSnapshot: string;
  unitPricePaise: number;
  quantity: number;
};

export type UpiSessionResult =
  | { ok: true; id: string; payAmountPaise: number; expiresAt: Date }
  | { ok: false; reason: "saturated" };

// Nonce range (paise): the buyer overpays the seller by 1..99 paise (≤ ₹0.99) so
// each live session has a unique payable amount. 99 slots × the short TTL is ample
// headroom at creator scale; a collision just retries, and true saturation (all
// slots taken for one base price) returns { saturated }.
const UPI_NONCE_MAX_PAISE = 99;

/**
 * Create a manual-UPI auto-confirm SESSION: a PENDING/UPI_MANUAL order with a
 * UNIQUE payable amount = `amountPaise` (true sale price) + a small nonce, and an
 * `expiresAt` TTL. `amountPaise` stays the commission/receipt/refund base (the
 * nonce lives only in `payAmountPaise`, what the buyer is told to pay — the few
 * paise go straight to the seller, never InvoxAI). Sweeps stale sessions first to
 * free their amounts, then retries on the (tenant, payAmountPaise) partial unique
 * index until it lands a free amount. Reused by all buyer surfaces. Tenant is
 * always passed by the server (never the client), so it can't cross tenants.
 */
export async function createUpiSession(input: {
  tenantId: string;
  amountPaise: number; // base, server-trusted (post-discount)
  ttlMinutes: number;
  itemTitle: string;
  paymentPageId?: string | null;
  productId?: string | null;
  courseId?: string | null;
  communityId?: string | null;
  workshopId?: string | null;
  quantity?: number;
  couponId?: string | null;
  couponCode?: string | null;
  discountPaise?: number;
  items?: UpiSessionItem[] | null;
  buyerProfileId?: string | null;
  buyerEmail?: string | null;
  buyerContact?: string | null;
  utm?: UtmFields | null;
  affiliate?: AffiliateFields | null;
}): Promise<UpiSessionResult> {
  await expireStaleUpiOrders(input.tenantId); // free stale amounts before allocating
  const expiresAt = new Date(Date.now() + input.ttlMinutes * 60_000);

  for (let attempt = 0; attempt < 16; attempt++) {
    const nonce = 1 + Math.floor(Math.random() * UPI_NONCE_MAX_PAISE);
    const payAmountPaise = input.amountPaise + nonce;
    try {
      const row = await prisma.buyerPayment.create({
        data: {
          razorpayOrderId: `upi_${randomUUID()}`,
          tenantId: input.tenantId,
          paymentPageId: input.paymentPageId ?? null,
          productId: input.productId ?? null,
          courseId: input.courseId ?? null,
          communityId: input.communityId ?? null,
          workshopId: input.workshopId ?? null,
          quantity: input.quantity ?? 1,
          itemTitle: input.itemTitle,
          amountPaise: input.amountPaise, // TRUE sale price — commission/receipt base
          payAmountPaise, // what the buyer pays = base + nonce
          couponId: input.couponId ?? null,
          couponCode: input.couponCode ?? null,
          discountPaise: input.discountPaise ?? 0,
          status: "PENDING",
          paymentMethod: "UPI_MANUAL",
          expiresAt,
          buyerProfileId: input.buyerProfileId ?? null,
          buyerEmail: input.buyerEmail ?? null,
          buyerContact: input.buyerContact ?? null,
          ...utmData(input.utm),
      ...affiliateData(input.affiliate),
          ...(input.items && input.items.length > 0
            ? {
                orderItems: {
                  create: input.items.map((it) => ({
                    productId: it.productId,
                    titleSnapshot: it.titleSnapshot,
                    unitPricePaise: it.unitPricePaise,
                    quantity: it.quantity,
                  })),
                },
              }
            : {}),
        },
        select: { id: true },
      });
      return { ok: true, id: row.id, payAmountPaise, expiresAt };
    } catch (e) {
      // (tenant, payAmountPaise) collided with another live session — retry.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  return { ok: false, reason: "saturated" };
}

/**
 * Lazy expiry: sweep a tenant's UN-SUBMITTED (upiRef null) PENDING UPI sessions
 * whose TTL has passed → EXPIRED, freeing their unique amounts. Submitted orders
 * (upiRef set, awaiting auto/manual confirm) are never expired. Called before
 * allocating an amount and before a confirm, so no cron is required.
 */
export function expireStaleUpiOrders(tenantId: string) {
  return prisma.buyerPayment.updateMany({
    where: {
      tenantId,
      status: "PENDING",
      paymentMethod: "UPI_MANUAL",
      upiRef: null,
      expiresAt: { lt: new Date() },
    },
    data: { status: "EXPIRED" },
  });
}

/** True when a tenant's outstanding DUE commission exceeds the platform ceiling. */
export async function isUpiAutoConfirmBlocked(tenantId: string): Promise<boolean> {
  const [due, threshold] = await Promise.all([
    prisma.commissionCharge.aggregate({
      where: { tenantId, status: "DUE" },
      _sum: { amountPaise: true },
    }),
    getUpiDueBlockPaise(),
  ]);
  return (due._sum.amountPaise ?? 0) > threshold;
}

/** Order summary returned on a confirm/hold, so the caller can fire seller
 *  notifications (sale / out-of-stock / "to confirm") without a re-query. */
type UpiOrderSummary = { buyerPaymentId: string; itemTitle: string | null; amountPaise: number };

export type UpiSubmitResult =
  | ({ ok: true; confirmed: true; alreadyProcessed: boolean; commission: "paid" | "due" | "none" } & UpiOrderSummary)
  | ({ ok: true; confirmed: false; pending: true; alreadyProcessed: boolean } & UpiOrderSummary)
  | { ok: false; reason: "not_found" | "expired" | "duplicate" };

/**
 * Does paying this order hand the buyer something INSTANTLY (so an unverified,
 * buyer-typed UPI reference must NOT auto-complete it — H1)? True for any course,
 * community, bare payment-page link, or non-PHYSICAL product, including a cart
 * line that is digital/service or whose product row is gone (unknown → treat as
 * instant). Only a purely-PHYSICAL order — which still needs fulfilment before
 * the buyer receives anything — returns false and is safe to auto-confirm.
 */
async function upiOrderGrantsInstantAccess(order: {
  id: string;
  productId: string | null;
  courseId: string | null;
  communityId: string | null;
  workshopId: string | null;
}): Promise<boolean> {
  if (order.courseId || order.communityId || order.workshopId) return true;

  const [items, directProduct] = await Promise.all([
    prisma.orderItem.findMany({
      where: { buyerPaymentId: order.id },
      select: { product: { select: { kind: true } } },
    }),
    order.productId
      ? prisma.product.findUnique({ where: { id: order.productId }, select: { kind: true } })
      : Promise.resolve(null),
  ]);

  const kinds = [
    ...items.map((i) => i.product?.kind ?? null),
    ...(order.productId ? [directProduct?.kind ?? null] : []),
  ];

  // No product lines at all → a bare payment-page link (could deliver a digital
  // good/service) → treat as instant. Otherwise instant if ANY line is
  // non-physical or its product is missing/unknown.
  if (kinds.length === 0) return true;
  return kinds.some((k) => k !== "PHYSICAL");
}

/**
 * Buyer submits their UPI reference for a session. Stamps the reference (a partial
 * unique index rejects a reference already used by another order → `duplicate`),
 * then EITHER auto-confirms instantly (claim PENDING→PAID + commission, reusing
 * the exact shared path as a Razorpay sale) when the seller has auto-confirm on,
 * the amount is within their cap, they're not dues-blocked, AND the order is
 * purely physical (instant-delivery goods never auto-confirm off an unverified
 * UTR — see upiOrderGrantsInstantAccess, H1); OR leaves the order PENDING with
 * the reference for manual seller confirmation (the existing queue). Tenant-
 * scoped. Never refuses the buyer — always confirms or holds.
 */
export async function autoConfirmOrHoldUpiOrder(
  tenantId: string,
  buyerPaymentId: string,
  utr: string,
): Promise<UpiSubmitResult> {
  await expireStaleUpiOrders(tenantId);
  const now = new Date();

  const order = await prisma.buyerPayment.findFirst({
    where: { id: buyerPaymentId, tenantId, paymentMethod: "UPI_MANUAL" },
    select: {
      id: true, status: true, amountPaise: true, itemTitle: true, upiRef: true, expiresAt: true,
      productId: true, courseId: true, communityId: true, workshopId: true,
    },
  });
  if (!order) return { ok: false, reason: "not_found" };
  const summary: UpiOrderSummary = {
    buyerPaymentId: order.id,
    itemTitle: order.itemTitle,
    amountPaise: order.amountPaise,
  };
  if (order.status === "PAID")
    return { ok: true, confirmed: true, alreadyProcessed: true, commission: "none", ...summary };
  if (order.status !== "PENDING") return { ok: false, reason: "expired" };
  if (order.expiresAt && order.expiresAt.getTime() < now.getTime())
    return { ok: false, reason: "expired" };
  if (order.upiRef)
    return { ok: true, confirmed: false, pending: true, alreadyProcessed: true, ...summary }; // already submitted

  // Decide auto vs hold from config + dues BEFORE the tx (a dues race here is
  // inconsequential — it only nudges one borderline order to the manual queue).
  const [cfg, blocked, grantsInstant] = await Promise.all([
    prisma.sellerUpi.findUnique({
      where: { tenantId },
      select: { autoConfirm: true, autoConfirmMaxPaise: true, enabled: true },
    }),
    isUpiAutoConfirmBlocked(tenantId),
    upiOrderGrantsInstantAccess(order),
  ]);
  const shouldAuto =
    !!cfg &&
    cfg.enabled &&
    cfg.autoConfirm &&
    (cfg.autoConfirmMaxPaise == null || order.amountPaise <= cfg.autoConfirmMaxPaise) &&
    !blocked &&
    // H1: never auto-complete an order that grants instant access (digital /
    // course / community / non-physical) off an unverified, buyer-typed UTR.
    // Only purely-physical orders (which still need fulfilment) may auto-confirm;
    // everything else falls to the seller's manual-confirm queue.
    !grantsInstant;

  try {
    return await prisma.$transaction(async (tx) => {
      // Stamp the reference only if still a live unsubmitted session (guards a
      // race with a concurrent sweep / double-submit). The unique index throws
      // P2002 here if this reference is already used elsewhere → caught below.
      const stamp = await tx.buyerPayment.updateMany({
        where: { id: order.id, tenantId, status: "PENDING", upiRef: null },
        data: { upiRef: utr },
      });
      if (stamp.count === 0) return { ok: false, reason: "expired" };

      if (!shouldAuto)
        return { ok: true, confirmed: false, pending: true, alreadyProcessed: false, ...summary };

      const res = await claimPendingAndApply(tx, tenantId, order.id, now);
      if (!res.ok) return { ok: false, reason: "not_found" };
      return {
        ok: true,
        confirmed: true,
        alreadyProcessed: res.alreadyProcessed,
        commission: res.commission,
        ...summary,
      };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, reason: "duplicate" };
    }
    throw e;
  }
}

export type CancelUpiResult =
  | { ok: true; alreadyProcessed: boolean; commissionReversedPaise: number }
  | { ok: false; reason: "not_found" };

/**
 * Seller cancels an auto-confirmed UPI order ("payment not received"). Atomically
 * claims PAID→CANCELLED (tenant + UPI scoped, idempotent), reverses the FULL
 * commission (CREDIT the wallet if it was PAID — with a dedicated `cancel_<id>`
 * reference distinct from the `commission_<id>` debit — else zero the DUE charge),
 * and reverses the side-effects (restock, decrement coupon redemption, delete the
 * enrolment). Because access reveal is gated on status PAID, the CANCELLED flip
 * revokes the buyer's access/receipt. Mirrors recordRefund's reversal at full
 * amount; no gateway refund (the buyer paid the seller's UPI directly).
 */
export async function cancelManualUpiOrder(
  tenantId: string,
  buyerPaymentId: string,
): Promise<CancelUpiResult> {
  return prisma.$transaction(async (tx) => {
    const claim = await tx.buyerPayment.updateMany({
      where: { id: buyerPaymentId, tenantId, status: "PAID", paymentMethod: "UPI_MANUAL" },
      data: { status: "CANCELLED" },
    });
    const order = await tx.buyerPayment.findFirst({
      where: { id: buyerPaymentId, tenantId },
      include: {
        commission: true,
        orderItems: { select: { productId: true, quantity: true } },
      },
    });
    if (claim.count === 0) {
      return order
        ? { ok: true, alreadyProcessed: true, commissionReversedPaise: 0 }
        : { ok: false, reason: "not_found" };
    }
    if (!order) return { ok: false, reason: "not_found" };

    // 1. Reverse the full commission.
    let commissionReversed = 0;
    if (order.commission && order.commission.amountPaise > 0) {
      commissionReversed = order.commission.amountPaise;
      if (order.commission.status === "PAID") {
        const wallet = await tx.wallet.upsert({
          where: { tenantId },
          create: { tenantId, balancePaise: commissionReversed },
          update: { balancePaise: { increment: commissionReversed } },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            tenantId,
            direction: "CREDIT",
            amountPaise: commissionReversed,
            balanceAfter: wallet.balancePaise,
            reason: "Commission reversal (UPI order cancelled)",
            referenceType: "upi_cancel",
            referenceId: `cancel_${order.id}`,
          },
        });
      } else {
        await tx.commissionCharge.update({
          where: { id: order.commission.id },
          data: { amountPaise: 0 },
        });
      }
    }

    // 2. Reverse side-effects (inverse of applyPaidEffects). Restock can rarely
    // over-credit (applyPaidEffects clamps decrement at 0) — accepted, same as the
    // documented oversell window; it's stock, not money.
    const lines = order.orderItems.filter((l) => l.productId);
    const restock =
      lines.length > 0
        ? lines.map((l) => ({ productId: l.productId as string, quantity: l.quantity }))
        : order.productId
          ? [{ productId: order.productId, quantity: order.quantity }]
          : [];
    for (const { productId, quantity } of restock) {
      await tx.product.updateMany({
        where: { id: productId, stockQty: { not: null } },
        data: { stockQty: { increment: quantity } },
      });
    }
    if (order.couponId) {
      await tx.coupon.updateMany({
        where: { id: order.couponId, redeemedCount: { gt: 0 } },
        data: { redeemedCount: { decrement: 1 } },
      });
    }
    await tx.enrolment.deleteMany({ where: { buyerPaymentId: order.id } });
    // Phase 12: revoke a community membership granted by this order (parity with
    // the enrolment revoke above).
    await tx.communityMembership.deleteMany({ where: { buyerPaymentId: order.id } });

    return { ok: true, alreadyProcessed: false, commissionReversedPaise: commissionReversed };
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
  // Lock the wallet row up front: the loop below does a read-modify-write per
  // charge, which must not interleave with a concurrent debit/credit on this wallet.
  const wallet = await lockWalletForUpdate(tx, tenantId);
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
