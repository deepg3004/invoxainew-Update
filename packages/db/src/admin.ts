import { prisma } from "./client";

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
export function listTenantsAdmin(search?: string) {
  const q = search?.trim();
  const where = q
    ? {
        OR: [
          { username: { contains: q, mode: "insensitive" as const } },
          { name: { contains: q, mode: "insensitive" as const } },
          { owner: { email: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : {};
  return prisma.tenant.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      owner: { select: { email: true } },
      subscription: { select: { status: true, plan: { select: { name: true } } } },
      wallet: { select: { balancePaise: true } },
      gateway: { select: { status: true, mode: true } },
      _count: { select: { buyerPayments: true, paymentPages: true, aiPages: true } },
    },
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
