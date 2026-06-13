import type { AbuseStatus } from "@prisma/client";
import { prisma } from "./client";

/**
 * Phase 16: abuse/scam reports against a tenant store. Filed anonymously from the
 * storefront (created server-side via Prisma, so deny-anon RLS is fine), triaged
 * by admins. Reviews are audited via AdminAuditLog.
 */

const REASONS = new Set(["fraud", "prohibited", "offensive", "spam", "other"]);

/** Record a public abuse report. `reason` is validated to a known category;
 *  free text + email are length-capped. Best-effort metadata (pageUrl/email). */
export function createAbuseReport(input: {
  tenantId: string;
  reason: string;
  detail?: string | null;
  reporterEmail?: string | null;
  pageUrl?: string | null;
}) {
  const reason = REASONS.has(input.reason) ? input.reason : "other";
  return prisma.abuseReport.create({
    data: {
      tenantId: input.tenantId,
      reason,
      detail: input.detail?.slice(0, 2000) || null,
      reporterEmail: input.reporterEmail?.slice(0, 200) || null,
      pageUrl: input.pageUrl?.slice(0, 500) || null,
    },
    select: { id: true },
  });
}

/** Admin: reports across all tenants, newest first, optionally filtered by status.
 *  Includes the reported store's username/name for the queue. */
export function listAbuseReports(opts: { status?: AbuseStatus; take?: number; skip?: number } = {}) {
  return prisma.abuseReport.findMany({
    where: opts.status ? { status: opts.status } : undefined,
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 50,
    skip: opts.skip ?? 0,
    include: { tenant: { select: { id: true, username: true, name: true, suspendedAt: true } } },
  });
}

/** Count of open (NEW) reports — feeds the admin bell. */
export function countOpenAbuseReports() {
  return prisma.abuseReport.count({ where: { status: "NEW" } });
}

/** Admin triage: set status + optional note, stamped with the reviewer, and write
 *  an AdminAuditLog entry — all in one transaction. */
export function reviewAbuseReport(input: {
  id: string;
  status: AbuseStatus;
  adminNote?: string | null;
  adminEmail: string;
}) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.abuseReport.update({
      where: { id: input.id },
      data: {
        status: input.status,
        adminNote: input.adminNote?.slice(0, 1000) ?? undefined,
        reviewedBy: input.adminEmail,
        reviewedAt: new Date(),
      },
      select: { tenantId: true },
    });
    await tx.adminAuditLog.create({
      data: {
        adminEmail: input.adminEmail,
        action: "abuse.review",
        tenantId: row.tenantId,
        detail: `${input.status}${input.adminNote ? ` — ${input.adminNote.slice(0, 200)}` : ""}`,
      },
    });
  });
}
