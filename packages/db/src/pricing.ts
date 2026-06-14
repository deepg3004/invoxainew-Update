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
  customDomainAllowed?: boolean; // premium custom-domain feature
  sortOrder?: number;
}

export type CreatePlanResult =
  | { ok: true; id: string }
  | { ok: false; reason: "key_taken" };

/** Create a plan. The `key` is globally unique; a clash is reported, not thrown. */
export async function createPlan(
  input: PlanInput,
  adminEmail: string,
): Promise<CreatePlanResult> {
  try {
    const plan = await prisma.$transaction(async (tx) => {
      const p = await tx.plan.create({
        data: {
          key: input.key,
          name: input.name,
          description: input.description ?? null,
          priceMonthly: input.priceMonthly,
          priceYearly: input.priceYearly,
          commissionBps: input.commissionBps,
          maxProducts: input.maxProducts ?? null,
          maxAiPages: input.maxAiPages ?? null,
          customDomainAllowed: input.customDomainAllowed ?? false,
          sortOrder: input.sortOrder ?? 0,
        },
        select: { id: true },
      });
      await tx.adminAuditLog.create({
        data: { adminEmail, action: "plan.create", detail: `${input.name} (${input.key})` },
      });
      return p;
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
  adminEmail: string,
) {
  return prisma.$transaction([
    prisma.plan.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description ?? null,
        priceMonthly: input.priceMonthly,
        priceYearly: input.priceYearly,
        commissionBps: input.commissionBps,
        maxProducts: input.maxProducts ?? null,
        maxAiPages: input.maxAiPages ?? null,
        customDomainAllowed: input.customDomainAllowed ?? false,
        sortOrder: input.sortOrder ?? 0,
      },
    }),
    prisma.adminAuditLog.create({
      data: { adminEmail, action: "plan.update", detail: input.name },
    }),
  ]);
}

/** Retire / restore a plan. We never hard-delete (sellers may be subscribed). */
export function setPlanActive(id: string, isActive: boolean, adminEmail: string) {
  return prisma.$transaction([
    prisma.plan.update({ where: { id }, data: { isActive } }),
    prisma.adminAuditLog.create({
      data: { adminEmail, action: isActive ? "plan.restore" : "plan.retire", detail: id },
    }),
  ]);
}

/**
 * Whether a tenant's plan allows connecting a custom domain (Phase 15 gating).
 * Reads the active subscription's plan, falling back to the Free plan when
 * unsubscribed. Defaults to false if no plan resolves.
 */
export async function planAllowsCustomDomain(tenantId: string): Promise<boolean> {
  const sub = await prisma.subscription.findUnique({
    where: { tenantId },
    include: { plan: { select: { customDomainAllowed: true } } },
  });
  if (sub) return sub.plan.customDomainAllowed;
  const free = await prisma.plan.findUnique({
    where: { key: "free" },
    select: { customDomainAllowed: true },
  });
  return free?.customDomainAllowed ?? false;
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
export function upsertPricingSetting(
  input: {
    key: string;
    label: string;
    valuePaise: number;
  },
  adminEmail: string,
) {
  return prisma.$transaction([
    prisma.pricingSetting.upsert({
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
    }),
    prisma.adminAuditLog.create({
      data: {
        adminEmail,
        action: "pricing.update",
        amountPaise: input.valuePaise,
        detail: input.key,
      },
    }),
  ]);
}
