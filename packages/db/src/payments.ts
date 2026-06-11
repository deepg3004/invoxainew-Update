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

export function createBuyerPayment(input: {
  razorpayOrderId: string;
  tenantId: string;
  paymentPageId: string;
  amountPaise: number;
  buyerEmail?: string | null;
  buyerContact?: string | null;
}) {
  return prisma.buyerPayment.create({
    data: {
      razorpayOrderId: input.razorpayOrderId,
      tenantId: input.tenantId,
      paymentPageId: input.paymentPageId,
      amountPaise: input.amountPaise,
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
