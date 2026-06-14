import { randomUUID } from "node:crypto";
import { prisma } from "./client";
import { lockWalletForUpdate } from "./wallet";

/**
 * Feature Billing engine (Final Plan §10). Admin-configurable paid features:
 * each plan grants a free monthly allowance; beyond it the feature is charged
 * (base + GST) from the seller's wallet. Generalises the AI-page ₹149 pattern.
 *
 * MONEY (hard rule): charges only ever move the SELLER's wallet money, never
 * buyer money. `consumeFeature` does the allowance check + debit + usage bump in
 * ONE transaction (balance can't race negative).
 */

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ── Admin config ─────────────────────────────────────────────────────────────

export function getFeatureRule(featureKey: string) {
  return prisma.featureRule.findUnique({ where: { featureKey } });
}

export function listFeatureRules() {
  return prisma.featureRule.findMany({ orderBy: { featureKey: "asc" } });
}

export function upsertFeatureRule(input: {
  featureKey: string;
  name: string;
  basePaise: number;
  gstRateBps: number;
  walletEnabled: boolean;
  directEnabled: boolean;
  active: boolean;
}) {
  return prisma.featureRule.upsert({
    where: { featureKey: input.featureKey },
    create: input,
    update: {
      name: input.name,
      basePaise: input.basePaise,
      gstRateBps: input.gstRateBps,
      walletEnabled: input.walletEnabled,
      directEnabled: input.directEnabled,
      active: input.active,
    },
  });
}

export function setPlanFeatureLimit(
  planId: string,
  featureKey: string,
  freeLimit: number,
) {
  return prisma.planFeatureLimit.upsert({
    where: { planId_featureKey: { planId, featureKey } },
    create: { planId, featureKey, freeLimit },
    update: { freeLimit },
  });
}

/** All plan→feature free limits, for the admin grid. */
export function listPlanFeatureLimits() {
  return prisma.planFeatureLimit.findMany();
}

/** This tenant's usage for a feature in the current month. */
export function getFeatureUsage(tenantId: string, featureKey: string) {
  return prisma.featureUsage.findUnique({
    where: {
      tenantId_featureKey_period: {
        tenantId,
        featureKey,
        period: currentPeriod(),
      },
    },
  });
}

export interface FeatureUsageRow {
  featureKey: string;
  name: string;
  freeLimit: number; // -1 = unlimited
  used: number;
  remaining: number; // -1 = unlimited
  totalPaise: number; // overage price incl GST
}

/** Per-feature usage + allowance for a tenant this month (seller usage page). */
export async function getTenantFeatureUsageSummary(
  tenantId: string,
): Promise<{ planName: string | null; features: FeatureUsageRow[] }> {
  const [rules, sub] = await Promise.all([
    prisma.featureRule.findMany({ where: { active: true }, orderBy: { featureKey: "asc" } }),
    prisma.subscription.findUnique({
      where: { tenantId },
      select: { planId: true, plan: { select: { name: true } } },
    }),
  ]);
  const period = currentPeriod();
  const features: FeatureUsageRow[] = [];
  for (const r of rules) {
    let freeLimit = 0;
    if (sub) {
      const lim = await prisma.planFeatureLimit.findUnique({
        where: { planId_featureKey: { planId: sub.planId, featureKey: r.featureKey } },
      });
      freeLimit = lim?.freeLimit ?? 0;
    }
    const usage = await prisma.featureUsage.findUnique({
      where: { tenantId_featureKey_period: { tenantId, featureKey: r.featureKey, period } },
    });
    const used = usage?.count ?? 0;
    const gst = Math.round((r.basePaise * r.gstRateBps) / 10000);
    features.push({
      featureKey: r.featureKey,
      name: r.name,
      freeLimit,
      used,
      remaining: freeLimit < 0 ? -1 : Math.max(0, freeLimit - used),
      totalPaise: r.basePaise + gst,
    });
  }
  return { planName: sub?.plan?.name ?? null, features };
}

// ── The engine ───────────────────────────────────────────────────────────────

export interface FeatureQuota {
  active: boolean;
  freeLimit: number; // -1 = unlimited
  used: number;
  remainingFree: number; // -1 = unlimited
  basePaise: number;
  gstPaise: number;
  totalPaise: number;
  walletEnabled: boolean;
  directEnabled: boolean;
}

/** Read-only quota + price for a tenant+feature this month (for UI). */
export async function getFeatureQuota(
  tenantId: string,
  featureKey: string,
): Promise<FeatureQuota | null> {
  const rule = await prisma.featureRule.findUnique({ where: { featureKey } });
  if (!rule) return null;
  const sub = await prisma.subscription.findUnique({
    where: { tenantId },
    select: { planId: true },
  });
  let freeLimit = 0;
  if (sub) {
    const lim = await prisma.planFeatureLimit.findUnique({
      where: { planId_featureKey: { planId: sub.planId, featureKey } },
    });
    freeLimit = lim?.freeLimit ?? 0;
  }
  const usage = await prisma.featureUsage.findUnique({
    where: {
      tenantId_featureKey_period: { tenantId, featureKey, period: currentPeriod() },
    },
  });
  const used = usage?.count ?? 0;
  const gstPaise = Math.round((rule.basePaise * rule.gstRateBps) / 10000);
  return {
    active: rule.active,
    freeLimit,
    used,
    remainingFree: freeLimit < 0 ? -1 : Math.max(0, freeLimit - used),
    basePaise: rule.basePaise,
    gstPaise,
    totalPaise: rule.basePaise + gstPaise,
    walletEnabled: rule.walletEnabled,
    directEnabled: rule.directEnabled,
  };
}

export type ConsumeResult =
  | {
      ok: true;
      charged: "free" | "wallet" | "direct";
      amountPaise: number;
      remainingFree: number;
      referenceId?: string;
    }
  | {
      ok: false;
      reason: "unavailable" | "insufficient_funds" | "payment_required";
      pricePaise?: number;
      directAvailable?: boolean;
    };

/**
 * Consume one unit of a feature for a tenant. Free while within the plan's
 * monthly allowance; otherwise: a prepaid direct-payment credit (bought via the
 * platform gateway, see startFeaturePayment) is claimed first, else base+GST is
 * debited from the wallet (when wallet payment is enabled). Returns
 * `payment_required` when there's no credit and only direct payment is enabled —
 * the caller routes the seller to startFeaturePayment. Atomic.
 */
export async function consumeFeature(input: {
  tenantId: string;
  featureKey: string;
}): Promise<ConsumeResult> {
  return prisma.$transaction(async (tx) => {
    const rule = await tx.featureRule.findUnique({
      where: { featureKey: input.featureKey },
    });
    if (!rule || !rule.active) return { ok: false, reason: "unavailable" };

    // Free allowance from the tenant's current plan.
    const sub = await tx.subscription.findUnique({
      where: { tenantId: input.tenantId },
      select: { planId: true },
    });
    let freeLimit = 0;
    if (sub) {
      const lim = await tx.planFeatureLimit.findUnique({
        where: { planId_featureKey: { planId: sub.planId, featureKey: input.featureKey } },
      });
      freeLimit = lim?.freeLimit ?? 0;
    }

    const period = currentPeriod();
    const usage = await tx.featureUsage.upsert({
      where: {
        tenantId_featureKey_period: { tenantId: input.tenantId, featureKey: input.featureKey, period },
      },
      create: { tenantId: input.tenantId, featureKey: input.featureKey, period, count: 0 },
      update: {},
      select: { id: true, count: true },
    });

    // Within the free allowance? (-1 = unlimited)
    if (freeLimit < 0 || usage.count < freeLimit) {
      await tx.featureUsage.update({ where: { id: usage.id }, data: { count: { increment: 1 } } });
      const remainingFree = freeLimit < 0 ? -1 : freeLimit - usage.count - 1;
      return { ok: true, charged: "free", amountPaise: 0, remainingFree };
    }

    // Over the allowance — needs payment.
    const gstPaise = Math.round((rule.basePaise * rule.gstRateBps) / 10000);
    const totalPaise = rule.basePaise + gstPaise;

    // Prepaid direct-payment credit first: a paid FEATURE platform order minted
    // an unconsumed FeatureCharge (payVia="direct"). Atomically claim the oldest
    // one — `updateMany ... where consumedAt = null` so two concurrent consumes
    // can't both take the same credit.
    const credit = await tx.featureCharge.findFirst({
      where: { tenantId: input.tenantId, featureKey: input.featureKey, payVia: "direct", consumedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (credit) {
      const claimed = await tx.featureCharge.updateMany({
        where: { id: credit.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      if (claimed.count === 1) {
        await tx.featureUsage.update({ where: { id: usage.id }, data: { count: { increment: 1 } } });
        return { ok: true, charged: "direct", amountPaise: totalPaise, remainingFree: 0, referenceId: credit.id };
      }
      // Lost the race for this credit — fall through to wallet / payment_required.
    }

    if (rule.walletEnabled) {
      // Lock the wallet row so this feature debit can't lose a concurrent fee/commission.
      const wallet = await lockWalletForUpdate(tx, input.tenantId);
      if (!wallet || wallet.balancePaise < totalPaise) {
        return {
          ok: false,
          reason: "insufficient_funds",
          pricePaise: totalPaise,
          directAvailable: rule.directEnabled,
        };
      }
      const balanceAfter = wallet.balancePaise - totalPaise;
      const ref = `feature_${randomUUID()}`;
      await tx.wallet.update({ where: { id: wallet.id }, data: { balancePaise: balanceAfter } });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          tenantId: input.tenantId,
          direction: "DEBIT",
          amountPaise: totalPaise,
          balanceAfter,
          reason: `${rule.name} fee`,
          referenceType: "feature",
          referenceId: ref,
        },
      });
      await tx.featureCharge.create({
        data: {
          tenantId: input.tenantId,
          featureKey: input.featureKey,
          basePaise: rule.basePaise,
          gstPaise,
          totalPaise,
          payVia: "wallet",
          referenceId: ref,
        },
      });
      await tx.featureUsage.update({ where: { id: usage.id }, data: { count: { increment: 1 } } });
      return { ok: true, charged: "wallet", amountPaise: totalPaise, remainingFree: 0, referenceId: ref };
    }

    if (rule.directEnabled) {
      return { ok: false, reason: "payment_required", pricePaise: totalPaise };
    }
    return { ok: false, reason: "unavailable" };
  });
}

// ── Seller-facing reads ──────────────────────────────────────────────────────

export type FeatureChargeRow = {
  id: string;
  featureKey: string;
  name: string;
  basePaise: number;
  gstPaise: number;
  totalPaise: number;
  payVia: string;
  referenceId: string;
  createdAt: Date;
};

/**
 * A tenant's feature-billing history (AI-page charges, etc.), newest first.
 * `FeatureCharge` stores only the feature KEY, so we resolve human names from
 * the rule table in one extra query. Tenant-scoped: a charge is only ever read
 * by its owning tenant (the `[tenantId, createdAt]` index serves this directly).
 */
export async function listFeatureCharges(
  tenantId: string,
  opts: { take?: number; skip?: number } = {},
): Promise<FeatureChargeRow[]> {
  const take = Math.min(Math.max(opts.take ?? 50, 1), 100);
  const skip = Math.max(opts.skip ?? 0, 0);

  const rows = await prisma.featureCharge.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take,
    skip,
  });

  const keys = [...new Set(rows.map((r) => r.featureKey))];
  const rules = keys.length
    ? await prisma.featureRule.findMany({
        where: { featureKey: { in: keys } },
        select: { featureKey: true, name: true },
      })
    : [];
  const nameByKey = new Map(rules.map((r) => [r.featureKey, r.name]));

  return rows.map((r) => ({
    id: r.id,
    featureKey: r.featureKey,
    name: nameByKey.get(r.featureKey) ?? r.featureKey,
    basePaise: r.basePaise,
    gstPaise: r.gstPaise,
    totalPaise: r.totalPaise,
    payVia: r.payVia,
    referenceId: r.referenceId,
    createdAt: r.createdAt,
  }));
}

/** Count of a tenant's feature charges (for pagination). */
export function countFeatureCharges(tenantId: string): Promise<number> {
  return prisma.featureCharge.count({ where: { tenantId } });
}

/**
 * How many unconsumed prepaid direct-payment credits the tenant holds, keyed by
 * feature. Each is one paid-but-unused FeatureCharge (payVia="direct") that the
 * next consumeFeature for that feature will claim instead of the wallet.
 */
export async function availableFeatureCreditsByKey(
  tenantId: string,
): Promise<Record<string, number>> {
  const rows = await prisma.featureCharge.groupBy({
    by: ["featureKey"],
    where: { tenantId, payVia: "direct", consumedAt: null },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.featureKey, r._count._all]));
}

/** Lifetime total a tenant has been charged for paid features (in paise). */
export async function sumFeatureChargesPaise(tenantId: string): Promise<number> {
  const agg = await prisma.featureCharge.aggregate({
    where: { tenantId },
    _sum: { totalPaise: true },
  });
  return agg._sum.totalPaise ?? 0;
}
