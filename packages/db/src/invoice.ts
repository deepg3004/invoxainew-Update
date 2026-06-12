import { Prisma } from "@prisma/client";
import { prisma } from "./client";

/**
 * GST tax-invoice issuance (Phase 1.3) for charges a seller paid InvoxAI.
 *
 * Numbering is a GAP-FREE per-financial-year sequence (Indian FY runs Apr–Mar):
 * each issue atomically increments InvoiceCounter inside the same transaction
 * that inserts the invoice, so numbers are contiguous and never duplicated.
 * Issuance is idempotent on (refType, refId) — re-running never double-issues.
 * The charge total is treated as tax-INCLUSIVE and split into base + GST.
 */

/** Indian financial-year label for a date, e.g. 2026-03-15 → "2025-26". */
function financialYear(d: Date): string {
  const y = d.getFullYear();
  const startYear = d.getMonth() >= 3 ? y : y - 1; // Apr (month 3) starts the FY
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/** Split a tax-inclusive total into base + GST at `gstRateBps`. */
function splitInclusive(totalPaise: number, gstRateBps: number) {
  const base = Math.round((totalPaise * 10000) / (10000 + gstRateBps));
  return { basePaise: base, taxPaise: totalPaise - base };
}

interface Issuable {
  kind: string;
  refType: string;
  refId: string;
  descriptionLine: string;
  totalPaise: number;
}

/** Allocate the next FY number and insert one invoice, atomically. Idempotent. */
async function issueOne(
  tenantId: string,
  item: Issuable,
  gstRateBps: number,
  issuedAt: Date,
): Promise<void> {
  const fy = financialYear(issuedAt);
  const { basePaise, taxPaise } = splitInclusive(item.totalPaise, gstRateBps);
  try {
    await prisma.$transaction(async (tx) => {
      const counter = await tx.invoiceCounter.upsert({
        where: { fy },
        create: { fy, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
        select: { lastNumber: true },
      });
      const number = `INV-${fy}-${String(counter.lastNumber).padStart(4, "0")}`;
      await tx.invoice.create({
        data: {
          number,
          tenantId,
          kind: item.kind,
          refType: item.refType,
          refId: item.refId,
          descriptionLine: item.descriptionLine,
          basePaise,
          taxPaise,
          totalPaise: item.totalPaise,
          gstRateBps,
          issuedAt,
        },
      });
    });
  } catch (e) {
    // (refType, refId) unique → already issued; skip (idempotent).
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return;
    throw e;
  }
}

/**
 * Ensure a tax invoice exists for every PAID platform order of the tenant —
 * both SUBSCRIPTION and WALLET_TOPUP (lazy issuance, called when the seller opens
 * their invoices). Returns the count newly issued.
 *
 * Both are seller→InvoxAI payments via the platform gateway, so both are treated
 * identically: a tax-inclusive GST invoice in the shared INV-<FY> series, issued
 * in paidAt order so numbering is chronological. Idempotent on (refType, refId).
 *
 * TAX-TREATMENT NOTE (CA to confirm): a wallet recharge is invoiced HERE, at
 * recharge ("tax at collection"). The fee debits it funds (commission, AI pages)
 * must therefore NOT be GST-invoiced again when usage-side invoicing is built,
 * or that would double-count GST. The alternative (receipt at recharge + tax
 * invoice per fee debit) is also valid — pick one with the CA.
 */
export async function issuePlatformInvoices(
  tenantId: string,
  gstRateBps: number,
): Promise<number> {
  const orders = await prisma.platformOrder.findMany({
    where: { tenantId, purpose: { in: ["SUBSCRIPTION", "WALLET_TOPUP"] }, status: "PAID" },
    orderBy: { paidAt: "asc" },
    include: { plan: { select: { name: true } } },
  });
  const existing = new Set(
    (
      await prisma.invoice.findMany({
        where: { tenantId, refType: "platform_order" },
        select: { refId: true },
      })
    ).map((i) => i.refId),
  );
  let issued = 0;
  for (const o of orders) {
    if (existing.has(o.id)) continue;
    const isTopup = o.purpose === "WALLET_TOPUP";
    await issueOne(
      tenantId,
      {
        kind: isTopup ? "WALLET_TOPUP" : "SUBSCRIPTION",
        refType: "platform_order",
        refId: o.id,
        descriptionLine: isTopup
          ? "Wallet recharge"
          : `${o.plan?.name ?? "Plan"} subscription (${(o.billingCycle ?? "MONTHLY").toLowerCase()})`,
        totalPaise: o.amountPaise,
      },
      gstRateBps,
      o.paidAt ?? o.createdAt,
    );
    issued += 1;
  }
  return issued;
}

/** A tenant's invoices, newest first. Scoped. */
export function listInvoices(tenantId: string) {
  return prisma.invoice.findMany({
    where: { tenantId },
    orderBy: { issuedAt: "desc" },
  });
}

/** One invoice owned by the tenant. Scoped. */
export function getInvoice(tenantId: string, id: string) {
  return prisma.invoice.findFirst({ where: { id, tenantId } });
}
