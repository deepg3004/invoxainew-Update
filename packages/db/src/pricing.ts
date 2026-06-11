import { Prisma } from "@prisma/client";
import { prisma } from "./client";

/**
 * Platform pricing data access — subscription Plans and global PricingSettings.
 *
 * These rows are PLATFORM-GLOBAL (not tenant-scoped): only the platform admin
 * app touches them, and only after `requireAdmin()`. There is no per-user
 * scoping here by design — unlike tenant data, a plan is the same for everyone.
 *
 * MONEY: amounts are integer paise; commission is integer basis points. Callers
 * convert to/from rupees/percent at the UI edge — never store floats.
 */

// ── Plans ──────────────────────────────────────────────────────────────────

/** Every plan, active first, then by sortOrder — for the admin editor. */
export function listPlans() {
  return prisma.plan.findMany({
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

/** Active plans only, in display order — for seller-facing pricing (C4+). */
export function listActivePlans() {
  return prisma.plan.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export function getPlanById(id: string) {
  return prisma.plan.findUnique({ where: { id } });
}

/** Lookup by the stable code key (what application code references). */
export function getPlanByKey(key: string) {
  return prisma.plan.findUnique({ where: { key } });
}

export interface PlanInput {
  key: string;
  name: string;
  description?: string | null;
  priceMonthly: number; // paise
  priceYearly: number; // paise
  commissionBps: number; // basis points
  maxProducts?: number | null; // null = unlimited
  maxAiPages?: number | null; // null = unlimited
  sortOrder?: number;
}

export type CreatePlanResult =
  | { ok: true; id: string }
  | { ok: false; reason: "key_taken" };

/** Create a plan. The `key` is globally unique; a clash is reported, not thrown. */
export async function createPlan(input: PlanInput): Promise<CreatePlanResult> {
  try {
    const plan = await prisma.plan.create({
      data: {
        key: input.key,
        name: input.name,
        description: input.description ?? null,
        priceMonthly: input.priceMonthly,
        priceYearly: input.priceYearly,
        commissionBps: input.commissionBps,
        maxProducts: input.maxProducts ?? null,
        maxAiPages: input.maxAiPages ?? null,
        sortOrder: input.sortOrder ?? 0,
      },
      select: { id: true },
    });
    return { ok: true, id: plan.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, reason: "key_taken" };
    }
    throw e;
  }
}

/**
 * Update an existing plan's editable fields. `key` is intentionally NOT
 * editable — code and any stored subscriptions reference it, so it is the one
 * stable handle. Re-pricing is the whole point of this editor and is allowed.
 */
export function updatePlan(
  id: string,
  input: Omit<PlanInput, "key">,
) {
  return prisma.plan.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description ?? null,
      priceMonthly: input.priceMonthly,
      priceYearly: input.priceYearly,
      commissionBps: input.commissionBps,
      maxProducts: input.maxProducts ?? null,
      maxAiPages: input.maxAiPages ?? null,
      sortOrder: input.sortOrder ?? 0,
    },
  });
}

/** Retire / restore a plan. We never hard-delete (sellers may be subscribed). */
export function setPlanActive(id: string, isActive: boolean) {
  return prisma.plan.update({ where: { id }, data: { isActive } });
}

// ── Pricing settings (global key/value) ──────────────────────────────────────

/** All pricing knobs, in key order — for the admin editor. */
export function listPricingSettings() {
  return prisma.pricingSetting.findMany({ orderBy: { key: "asc" } });
}

export function getPricingSetting(key: string) {
  return prisma.pricingSetting.findUnique({ where: { key } });
}

/**
 * Create-or-update a pricing knob by key. `label` is only set on create (and
 * refreshed on update so a renamed label sticks); `valuePaise` is the editable
 * amount.
 */
export function upsertPricingSetting(input: {
  key: string;
  label: string;
  valuePaise: number;
}) {
  return prisma.pricingSetting.upsert({
    where: { key: input.key },
    create: {
      key: input.key,
      label: input.label,
      valuePaise: input.valuePaise,
    },
    update: {
      label: input.label,
      valuePaise: input.valuePaise,
    },
  });
}
