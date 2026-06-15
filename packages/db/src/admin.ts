import { randomUUID } from "node:crypto";
import { prisma } from "./client";
import { lockWalletForUpdate } from "./wallet";

/**
 * Platform-admin data access (Phase 3 admin console).
 *
 * SECURITY: unlike every other data-access module, these are deliberately
 * CROSS-TENANT — the admin console sees all tenants. They must ONLY ever be
 * called from the admin app behind `requireAdmin()` (the ADMIN_EMAILS
 * allowlist). Never import these into the seller/tenant apps. They never return
 * a gateway SECRET — only its non-secret key id / mode / status.
 */

export interface PlatformOverview {
  tenants: number;
  activeSubscriptions: number;
  buyerAccounts: number;
  paidOrders: number;
  gmvPaise: number;
  commissionPaidPaise: number;
  commissionDuePaise: number;
  walletBalancePaise: number;
  aiPages: number;
}

/** Platform-wide headline numbers for the admin home. */
export async function getPlatformOverview(): Promise<PlatformOverview> {
  const [tenants, subs, buyers, orders, commissions, wallets, aiPages] =
    await Promise.all([
      prisma.tenant.count(),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.buyerAccount.count(),
      prisma.buyerPayment.aggregate({
        where: { status: "PAID" },
        _count: { _all: true },
        _sum: { amountPaise: true },
      }),
      prisma.commissionCharge.groupBy({
        by: ["status"],
        _sum: { amountPaise: true },
      }),
      prisma.wallet.aggregate({ _sum: { balancePaise: true } }),
      prisma.aiPage.count(),
    ]);
  return {
    tenants,
    activeSubscriptions: subs,
    buyerAccounts: buyers,
    paidOrders: orders._count._all,
    gmvPaise: orders._sum.amountPaise ?? 0,
    commissionPaidPaise:
      commissions.find((c) => c.status === "PAID")?._sum.amountPaise ?? 0,
    commissionDuePaise:
      commissions.find((c) => c.status === "DUE")?._sum.amountPaise ?? 0,
    walletBalancePaise: wallets._sum.balancePaise ?? 0,
    aiPages,
  };
}

/** All tenants (newest first), optionally filtered by username/name/owner email. */
function tenantsAdminWhere(search?: string) {
  const q = search?.trim();
  return q
    ? {
        OR: [
          { username: { contains: q, mode: "insensitive" as const } },
          { name: { contains: q, mode: "insensitive" as const } },
          { owner: { email: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : {};
}

/** Count of tenants matching the admin search (drives pagination). */
export function countTenantsAdmin(search?: string) {
  return prisma.tenant.count({ where: tenantsAdminWhere(search) });
}

export function listTenantsAdmin(opts: { search?: string; skip?: number; take?: number } = {}) {
  return prisma.tenant.findMany({
    where: tenantsAdminWhere(opts.search),
    orderBy: { createdAt: "desc" },
    skip: opts.skip,
    take: opts.take ?? 100,
    include: {
      owner: { select: { email: true } },
      subscription: { select: { status: true, plan: { select: { name: true } } } },
      wallet: { select: { balancePaise: true } },
      gateway: { select: { status: true, mode: true } },
      _count: { select: { buyerPayments: true, paymentPages: true, aiPages: true } },
    },
  });
}

// ── Reports + search (Phase 3, slice 3) ──────────────────────────────────────

export interface RevenueReport {
  commissionCollectedPaise: number;
  commissionDuePaise: number;
  aiPageFeesPaise: number;
  aiPageCount: number;
  subscriptionRevenuePaise: number;
  subscriptionCount: number;
  walletTopupsPaise: number;
  walletLiabilityPaise: number;
  totalEarnedPaise: number;
}

/**
 * InvoxAI's own revenue (never buyer money): commission debited from seller
 * wallets, AI-page fees, and subscription payments. Wallet top-ups + current
 * balances are shown separately as the prepaid-money picture (a liability).
 *
 * `sinceDays` windows the earned/charged figures to that many days (by charge
 * date / paid date); omit for all-time. Wallet liability is always the CURRENT
 * held balance (a snapshot, not windowable).
 */
export async function getRevenueReport(sinceDays?: number): Promise<RevenueReport> {
  const since = sinceDays ? new Date(Date.now() - sinceDays * 86_400_000) : null;
  const createdW = since ? { createdAt: { gte: since } } : {};
  const paidW = since ? { paidAt: { gte: since } } : {};
  const [comm, aiFees, subRev, topups, liability] = await Promise.all([
    prisma.commissionCharge.groupBy({ by: ["status"], where: createdW, _sum: { amountPaise: true } }),
    prisma.walletTransaction.aggregate({
      where: { referenceType: "ai_page", direction: "DEBIT", ...createdW },
      _sum: { amountPaise: true },
      _count: { _all: true },
    }),
    prisma.platformOrder.aggregate({
      where: { purpose: "SUBSCRIPTION", status: "PAID", ...paidW },
      _sum: { amountPaise: true },
      _count: { _all: true },
    }),
    prisma.platformOrder.aggregate({
      where: { purpose: "WALLET_TOPUP", status: "PAID", ...paidW },
      _sum: { amountPaise: true },
    }),
    prisma.wallet.aggregate({ _sum: { balancePaise: true } }),
  ]);
  const commissionCollectedPaise =
    comm.find((c) => c.status === "PAID")?._sum.amountPaise ?? 0;
  const commissionDuePaise = comm.find((c) => c.status === "DUE")?._sum.amountPaise ?? 0;
  const aiPageFeesPaise = aiFees._sum.amountPaise ?? 0;
  const subscriptionRevenuePaise = subRev._sum.amountPaise ?? 0;
  return {
    commissionCollectedPaise,
    commissionDuePaise,
    aiPageFeesPaise,
    aiPageCount: aiFees._count._all,
    subscriptionRevenuePaise,
    subscriptionCount: subRev._count._all,
    walletTopupsPaise: topups._sum.amountPaise ?? 0,
    walletLiabilityPaise: liability._sum.balancePaise ?? 0,
    totalEarnedPaise:
      commissionCollectedPaise + aiPageFeesPaise + subscriptionRevenuePaise,
  };
}

export interface AttentionRow {
  id: string;
  username: string;
  balancePaise: number;
  commissionDuePaise: number;
}

/** Tenants that need attention: outstanding commission, or a low/empty wallet. */
export async function getWalletAttention(lowThresholdPaise = 5000): Promise<AttentionRow[]> {
  const [due, lowWallets] = await Promise.all([
    prisma.commissionCharge.groupBy({
      by: ["tenantId"],
      where: { status: "DUE" },
      _sum: { amountPaise: true },
    }),
    prisma.wallet.findMany({
      where: { balancePaise: { lt: lowThresholdPaise } },
      select: { tenantId: true },
    }),
  ]);
  const dueMap = new Map(due.map((d) => [d.tenantId, d._sum.amountPaise ?? 0]));
  const ids = new Set<string>([...dueMap.keys(), ...lowWallets.map((w) => w.tenantId)]);
  if (ids.size === 0) return [];
  const tenants = await prisma.tenant.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, username: true, wallet: { select: { balancePaise: true } } },
  });
  return tenants
    .map((t) => ({
      id: t.id,
      username: t.username,
      balancePaise: t.wallet?.balancePaise ?? 0,
      commissionDuePaise: dueMap.get(t.id) ?? 0,
    }))
    .sort((a, b) => b.commissionDuePaise - a.commissionDuePaise);
}

/** Cross-tenant buyer-payment search by email/contact (admin support). */
function buyerSearchWhere(q: string) {
  return {
    OR: [
      { buyerEmail: { contains: q, mode: "insensitive" as const } },
      { buyerContact: { contains: q } },
    ],
  };
}

export function searchBuyerPayments(query: string, opts: { skip?: number; take?: number } = {}) {
  const q = query.trim();
  if (!q) return Promise.resolve([]);
  return prisma.buyerPayment.findMany({
    where: buyerSearchWhere(q),
    orderBy: { createdAt: "desc" },
    skip: opts.skip,
    take: opts.take ?? 50,
    include: {
      tenant: { select: { id: true, username: true } },
      paymentPage: { select: { title: true } },
    },
  });
}

/** Count of buyer payments matching the support search (drives pagination). */
export function countBuyerPaymentsSearch(query: string): Promise<number> {
  const q = query.trim();
  if (!q) return Promise.resolve(0);
  return prisma.buyerPayment.count({ where: buyerSearchWhere(q) });
}

/** Recent accepted webhook events with processing state (Phase 1.5). */
export function listRecentPaymentEvents(take = 30) {
  return prisma.paymentEvent.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      eventId: true,
      type: true,
      createdAt: true,
      processedAt: true,
      attempts: true,
      lastError: true,
    },
  });
}

// ── Mutating admin actions (Phase 3, slice 2) ────────────────────────────────

/**
 * Suspend or un-suspend a tenant, with an audit-log entry, atomically.
 * Suspension blocks the storefront + buyer checkout (enforced in the tenant app).
 */
export async function setTenantSuspended(input: {
  tenantId: string;
  suspended: boolean;
  adminEmail: string;
  reason?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.tenant.update({
      where: { id: input.tenantId },
      data: { suspendedAt: input.suspended ? new Date() : null },
    });
    await tx.adminAuditLog.create({
      data: {
        adminEmail: input.adminEmail,
        action: input.suspended ? "tenant.suspend" : "tenant.unsuspend",
        tenantId: input.tenantId,
        detail: input.reason ?? null,
      },
    });
  });
}

export type ChargebackResult =
  | { ok: true; alreadyDone: boolean; commissionReversedPaise: number }
  | { ok: false; reason: "not_found" | "not_paid" };

/**
 * Mark a buyer payment as charged back (the bank reversed it on the seller's
 * gateway). InvoxAI reverses the commission on the still-live portion (amount
 * minus anything already refunded), computed from the recorded bps so it's
 * independent of prior partial reversals: PAID commission → wallet CREDIT;
 * DUE → reduce the outstanding amount. Idempotent via `chargebackAt`. Audited.
 */
export async function markChargeback(input: {
  tenantId: string;
  orderId: string;
  adminEmail: string;
}): Promise<ChargebackResult> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.buyerPayment.findFirst({
      where: { id: input.orderId, tenantId: input.tenantId },
      include: { commission: true },
    });
    if (!order) return { ok: false, reason: "not_found" };
    if (order.status !== "PAID") return { ok: false, reason: "not_paid" };
    if (order.chargebackAt) {
      return { ok: true, alreadyDone: true, commissionReversedPaise: 0 };
    }

    const liveAmount = order.amountPaise - order.refundedPaise;
    let reversed = 0;
    if (order.commission && liveAmount > 0) {
      reversed = Math.floor((liveAmount * order.commission.bps) / 10000);
      if (reversed > 0) {
        if (order.commission.status === "PAID") {
          const wallet = await tx.wallet.upsert({
            where: { tenantId: input.tenantId },
            create: { tenantId: input.tenantId, balancePaise: reversed },
            update: { balancePaise: { increment: reversed } },
          });
          await tx.walletTransaction.create({
            data: {
              walletId: wallet.id,
              tenantId: input.tenantId,
              direction: "CREDIT",
              amountPaise: reversed,
              balanceAfter: wallet.balancePaise,
              reason: "Commission reversal (chargeback)",
              referenceType: "chargeback",
              referenceId: `chargeback_${order.id}`,
            },
          });
        } else {
          await tx.commissionCharge.update({
            where: { id: order.commission.id },
            data: { amountPaise: Math.max(0, order.commission.amountPaise - reversed) },
          });
        }
      }
    }

    await tx.buyerPayment.update({
      where: { id: order.id },
      data: { chargebackAt: new Date(), refundedPaise: order.amountPaise },
    });
    await tx.adminAuditLog.create({
      data: {
        adminEmail: input.adminEmail,
        action: "order.chargeback",
        tenantId: input.tenantId,
        amountPaise: liveAmount,
        detail: `Chargeback on order ${order.id}; commission reversed ${reversed}p`,
      },
    });
    return { ok: true, alreadyDone: false, commissionReversedPaise: reversed };
  });
}

export type AdminWalletResult =
  | { ok: true; balancePaise: number }
  | { ok: false; reason: "insufficient_funds" };

/**
 * Manual wallet credit/debit by an admin (refunds, corrections, goodwill).
 *
 * One transaction does: balance check (debit never goes negative) → update
 * balance → append a WalletTransaction → write an AdminAuditLog. The wallet is
 * created on first credit. A unique `referenceId` ties the ledger row to the
 * audit entry. This only ever moves the SELLER's wallet money — never buyer
 * money (hard rule).
 */
export async function adminAdjustWallet(input: {
  tenantId: string;
  direction: "CREDIT" | "DEBIT";
  amountPaise: number;
  reason: string;
  adminEmail: string;
}): Promise<AdminWalletResult> {
  return prisma.$transaction(async (tx) => {
    // Ensure the wallet row exists (an admin may credit a tenant that has none
    // yet), then lock it FOR UPDATE so this adjustment can't lose a concurrent
    // fee/credit on the same wallet (lost-update → money drift). The upsert
    // alone doesn't serialise a later read-modify-write; the FOR UPDATE does.
    await tx.wallet.upsert({
      where: { tenantId: input.tenantId },
      create: { tenantId: input.tenantId },
      update: {},
    });
    const wallet = await lockWalletForUpdate(tx, input.tenantId);
    if (!wallet) return { ok: false, reason: "insufficient_funds" };

    const delta = input.direction === "CREDIT" ? input.amountPaise : -input.amountPaise;
    const balanceAfter = wallet.balancePaise + delta;
    if (balanceAfter < 0) {
      return { ok: false, reason: "insufficient_funds" };
    }

    const ref = `admin_${randomUUID()}`;
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balancePaise: balanceAfter },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        tenantId: input.tenantId,
        direction: input.direction,
        amountPaise: input.amountPaise,
        balanceAfter,
        reason: `Admin adjustment: ${input.reason}`,
        referenceType: "admin",
        referenceId: ref,
      },
    });
    await tx.adminAuditLog.create({
      data: {
        adminEmail: input.adminEmail,
        action: input.direction === "CREDIT" ? "wallet.credit" : "wallet.debit",
        tenantId: input.tenantId,
        amountPaise: input.amountPaise,
        detail: input.reason,
      },
    });
    return { ok: true, balancePaise: balanceAfter };
  });
}

/** Recent admin audit entries for a tenant. */
export function listAdminAuditLog(tenantId: string, take = 15) {
  return prisma.adminAuditLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

/** Recent GLOBAL (non-tenant) admin config changes — plan / pricing / feature /
 *  settings edits write rows with a null tenantId, so they don't show in the
 *  tenant-scoped view above. This surfaces them for the platform audit trail. */
export function listGlobalAdminAuditLog(take = 30) {
  return prisma.adminAuditLog.findMany({
    where: { tenantId: null },
    orderBy: { createdAt: "desc" },
    take,
  });
}

/** Full admin view of one tenant (no gateway secret — key id / mode / status only). */
export function getTenantAdminDetail(id: string) {
  return prisma.tenant.findUnique({
    where: { id },
    include: {
      owner: { select: { email: true, fullName: true, createdAt: true } },
      subscription: { include: { plan: { select: { name: true, key: true } } } },
      wallet: {
        include: {
          transactions: { orderBy: { createdAt: "desc" }, take: 10 },
        },
      },
      gateway: {
        select: {
          provider: true,
          keyId: true,
          mode: true,
          status: true,
          connectedAt: true,
        },
      },
      paymentPages: { orderBy: { createdAt: "desc" }, take: 25 },
      aiPages: {
        select: { id: true, slug: true, title: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 25,
      },
      buyerPayments: {
        where: { status: "PAID" },
        orderBy: { paidAt: "desc" },
        take: 25,
        include: {
          paymentPage: { select: { title: true } },
          commission: { select: { status: true, amountPaise: true } },
        },
      },
    },
  });
}
