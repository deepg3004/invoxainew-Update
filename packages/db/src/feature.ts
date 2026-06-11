import { randomUUID } from "node:crypto";
import { prisma } from "./client";

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

// ── The engine ───────────────────────────────────────────────────────────────

export type ConsumeResult =
  | { ok: true; charged: "free" | "wallet"; amountPaise: number; remainingFree: number }
  | {
      ok: false;
      reason: "unavailable" | "insufficient_funds" | "payment_required";
      pricePaise?: number;
      directAvailable?: boolean;
    };

/**
 * Consume one unit of a feature for a tenant. Free while within the plan's
 * monthly allowance; otherwise charged base+GST from the wallet (when wallet
 * payment is enabled). Returns `payment_required` when only direct payment is
 * enabled (handled by the platform-gateway flow — a later slice). Atomic.
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

    if (rule.walletEnabled) {
      const wallet = await tx.wallet.findUnique({ where: { tenantId: input.tenantId } });
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
      return { ok: true, charged: "wallet", amountPaise: totalPaise, remainingFree: 0 };
    }

    if (rule.directEnabled) {
      return { ok: false, reason: "payment_required", pricePaise: totalPaise };
    }
    return { ok: false, reason: "unavailable" };
  });
}
