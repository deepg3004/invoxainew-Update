import type { RiskSeverity, RiskStatus } from "@prisma/client";
import { prisma } from "./client";

/**
 * Phase 16: admin-facing risk alerts, DERIVED from data we already have
 * (chargebacks, open abuse reports, large uncollected commission). refreshRiskAlerts
 * is idempotent — one row per (tenant, type), upserted on each scan: a cleared
 * condition resolves the alert, a re-triggered one reopens, and an admin-dismissed
 * one stays dismissed. No buyer/money surface — read-only signals.
 */

// Rupee thresholds (in paise) for the commission-DUE rule.
const DUE_ALERT_PAISE = 100_000; // ₹1,000 uncollected → alert
const DUE_HIGH_PAISE = 500_000; // ₹5,000+ → HIGH

type Signal = { tenantId: string; type: string; severity: RiskSeverity; detail: string };

async function computeSignals(): Promise<Signal[]> {
  const [chargebacks, abuse, due] = await Promise.all([
    prisma.buyerPayment.groupBy({
      by: ["tenantId"],
      where: { chargebackAt: { not: null } },
      _count: { _all: true },
    }),
    prisma.abuseReport.groupBy({
      by: ["tenantId"],
      where: { status: "NEW" },
      _count: { _all: true },
    }),
    prisma.commissionCharge.groupBy({
      by: ["tenantId"],
      where: { status: "DUE" },
      _sum: { amountPaise: true },
    }),
  ]);

  const signals: Signal[] = [];
  for (const c of chargebacks) {
    const n = c._count._all;
    if (n <= 0) continue;
    signals.push({
      tenantId: c.tenantId,
      type: "chargebacks",
      severity: n >= 3 ? "HIGH" : "MEDIUM",
      detail: `${n} chargeback${n === 1 ? "" : "s"} on this store`,
    });
  }
  for (const a of abuse) {
    const n = a._count._all;
    if (n <= 0) continue;
    signals.push({
      tenantId: a.tenantId,
      type: "abuse_reports",
      severity: n >= 3 ? "HIGH" : "MEDIUM",
      detail: `${n} open abuse report${n === 1 ? "" : "s"}`,
    });
  }
  for (const d of due) {
    const sum = d._sum.amountPaise ?? 0;
    if (sum < DUE_ALERT_PAISE) continue;
    signals.push({
      tenantId: d.tenantId,
      type: "commission_due",
      severity: sum >= DUE_HIGH_PAISE ? "HIGH" : "MEDIUM",
      detail: `₹${(sum / 100).toLocaleString("en-IN")} commission uncollected`,
    });
  }
  return signals;
}

/**
 * Recompute risk alerts. For each active signal, upsert (create OPEN, or refresh
 * detail/severity — reopening a previously RESOLVED one, leaving a DISMISSED one
 * dismissed). OPEN alerts whose condition no longer holds are marked RESOLVED.
 */
export async function refreshRiskAlerts(): Promise<void> {
  const signals = await computeSignals();
  const existing = await prisma.riskAlert.findMany({
    select: { id: true, tenantId: true, type: true, status: true },
  });
  const exMap = new Map(existing.map((e) => [`${e.tenantId}|${e.type}`, e]));
  const activeKeys = new Set<string>();

  for (const s of signals) {
    const key = `${s.tenantId}|${s.type}`;
    activeKeys.add(key);
    const ex = exMap.get(key);
    if (!ex) {
      await prisma.riskAlert.create({
        data: { tenantId: s.tenantId, type: s.type, severity: s.severity, detail: s.detail },
      });
    } else {
      await prisma.riskAlert.update({
        where: { id: ex.id },
        data: {
          severity: s.severity,
          detail: s.detail,
          // Re-open a resolved alert; never override an admin dismissal.
          status: ex.status === "RESOLVED" ? "OPEN" : ex.status,
        },
      });
    }
  }

  // Auto-resolve OPEN alerts whose condition cleared.
  const stale = existing.filter(
    (e) => e.status === "OPEN" && !activeKeys.has(`${e.tenantId}|${e.type}`),
  );
  if (stale.length > 0) {
    await prisma.riskAlert.updateMany({
      where: { id: { in: stale.map((s) => s.id) } },
      data: { status: "RESOLVED" },
    });
  }
}

/** Risk alerts for the admin queue, with the store. Defaults to OPEN. */
export function listRiskAlerts(status: RiskStatus = "OPEN", take = 100) {
  return prisma.riskAlert.findMany({
    where: { status },
    orderBy: [{ severity: "desc" }, { updatedAt: "desc" }],
    take,
    include: { tenant: { select: { id: true, username: true, name: true, suspendedAt: true } } },
  });
}

/** Open-alert count — feeds the admin bell. */
export function countOpenRiskAlerts() {
  return prisma.riskAlert.count({ where: { status: "OPEN" } });
}

/** Dismiss an alert (admin chose to ignore it), audited. */
export function dismissRiskAlert(input: { id: string; adminEmail: string }) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.riskAlert.update({
      where: { id: input.id },
      data: { status: "DISMISSED", reviewedBy: input.adminEmail, reviewedAt: new Date() },
      select: { tenantId: true, type: true },
    });
    await tx.adminAuditLog.create({
      data: {
        adminEmail: input.adminEmail,
        action: "risk.dismiss",
        tenantId: row.tenantId,
        detail: row.type,
      },
    });
  });
}
