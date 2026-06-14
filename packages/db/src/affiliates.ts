import { type AffiliateStatus } from "@prisma/client";
import { prisma } from "./client";
import type { AffiliateFields } from "./payments";

/**
 * Affiliates / referrals (repo parity).
 *
 * MONEY MODEL (hard rule): an affiliate's commission is what the SELLER owes
 * their referral partner, OFF-PLATFORM. InvoxAI only RECORDS it on the order
 * (buyerPayment.affiliateCommissionPaise). It never touches the buyer's charge,
 * the seller's gateway, or the InvoxAI wallet commission. So attribution here is
 * purely additive bookkeeping — no money rail, no settlement.
 *
 * Codes are unique per tenant. Attribution flows from a `?ref=CODE` link the
 * buyer landed on (captured to a cookie, re-resolved server-side at checkout).
 */

const CODE_RE = /^[A-Za-z0-9_-]{2,40}$/;

export function normaliseAffiliateCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40);
}

export interface NewAffiliate {
  name: string;
  code: string;
  email?: string | null;
  commissionBps: number;
}

export type CreateAffiliateResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function createAffiliate(
  tenantId: string,
  input: NewAffiliate,
): Promise<CreateAffiliateResult> {
  const name = input.name.trim().slice(0, 120);
  if (!name) return { ok: false, error: "Name is required." };

  const code = normaliseAffiliateCode(input.code);
  if (!CODE_RE.test(code)) {
    return { ok: false, error: "Code must be 2–40 chars: letters, digits, - or _." };
  }

  // Commission 0–100% (basis points). Clamp defensively.
  const bps = Math.round(input.commissionBps);
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) {
    return { ok: false, error: "Commission must be between 0% and 100%." };
  }

  const email = (input.email ?? "").trim().slice(0, 200) || null;

  try {
    const row = await prisma.affiliate.create({
      data: { tenantId, name, code, email, commissionBps: bps },
      select: { id: true },
    });
    return { ok: true, id: row.id };
  } catch {
    // Unique (tenantId, code) collision is the only expected failure.
    return { ok: false, error: `The code "${code}" is already in use.` };
  }
}

export async function setAffiliateStatus(
  tenantId: string,
  id: string,
  status: AffiliateStatus,
) {
  await prisma.affiliate.updateMany({ where: { id, tenantId }, data: { status } });
}

export async function deleteAffiliate(tenantId: string, id: string) {
  // SetNull on buyerPayments.affiliateId keeps historical orders intact; only the
  // affiliate row goes away. Tenant-scoped so one seller can't delete another's.
  await prisma.affiliate.deleteMany({ where: { id, tenantId } });
}

/**
 * Increment the lightweight landing counter for a code. No-op (silently) when the
 * code doesn't resolve to an active affiliate for this tenant — so a forged/stale
 * ?ref can't create rows or error the storefront.
 */
export async function incrementAffiliateClick(tenantId: string, rawCode: string) {
  const code = normaliseAffiliateCode(rawCode);
  if (!CODE_RE.test(code)) return;
  await prisma.affiliate.updateMany({
    where: { tenantId, code, status: "ACTIVE" },
    data: { clicks: { increment: 1 } },
  });
}

export interface AffiliateWithStats {
  id: string;
  code: string;
  name: string;
  email: string | null;
  commissionBps: number;
  clicks: number;
  status: AffiliateStatus;
  createdAt: Date;
  /** Count of PAID orders attributed to this affiliate. */
  paidSales: number;
  /** Sum of those orders' charged totals (paise). */
  grossPaise: number;
  /** Sum of commission the seller owes this affiliate on PAID orders (paise). */
  commissionOwedPaise: number;
}

/**
 * Affiliates for a seller, each with PAID-order stats. Commission is only counted
 * over PAID orders (a CREATED/PENDING/FAILED order owes nothing). Two grouped
 * aggregates keyed by affiliateId, joined to the affiliate rows in app code.
 */
export async function listAffiliatesWithStats(
  tenantId: string,
): Promise<AffiliateWithStats[]> {
  const [affiliates, grouped] = await Promise.all([
    prisma.affiliate.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.buyerPayment.groupBy({
      by: ["affiliateId"],
      where: { tenantId, status: "PAID", affiliateId: { not: null } },
      _count: { _all: true },
      _sum: { amountPaise: true, affiliateCommissionPaise: true },
    }),
  ]);

  const stats = new Map(grouped.map((g) => [g.affiliateId, g]));
  return affiliates.map((a) => {
    const g = stats.get(a.id);
    return {
      id: a.id,
      code: a.code,
      name: a.name,
      email: a.email,
      commissionBps: a.commissionBps,
      clicks: a.clicks,
      status: a.status,
      createdAt: a.createdAt,
      paidSales: g?._count._all ?? 0,
      grossPaise: g?._sum.amountPaise ?? 0,
      commissionOwedPaise: g?._sum.affiliateCommissionPaise ?? 0,
    };
  });
}

/**
 * Resolve a `?ref=CODE` to the attribution stamped on a new order. Called at
 * checkout with the SERVER-TRUSTED post-discount amount, so the recorded
 * commission can never be inflated by the client. Returns all-null/zero when the
 * code is missing, malformed, or not an ACTIVE affiliate of this tenant.
 */
export async function resolveAffiliateAttribution(
  tenantId: string,
  rawCode: string | null | undefined,
  amountPaise: number,
): Promise<AffiliateFields> {
  const none: AffiliateFields = {
    affiliateId: null,
    affiliateCode: null,
    affiliateCommissionPaise: 0,
  };
  if (!rawCode) return none;
  const code = normaliseAffiliateCode(rawCode);
  if (!CODE_RE.test(code)) return none;

  const affiliate = await prisma.affiliate.findFirst({
    where: { tenantId, code, status: "ACTIVE" },
    select: { id: true, code: true, commissionBps: true },
  });
  if (!affiliate) return none;

  const commission = Math.floor((amountPaise * affiliate.commissionBps) / 10_000);
  return {
    affiliateId: affiliate.id,
    affiliateCode: affiliate.code,
    affiliateCommissionPaise: Math.max(0, commission),
  };
}
