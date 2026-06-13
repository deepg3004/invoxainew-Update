import { prisma } from "./client";

/**
 * Phase 16: seller verification (trust badge). The seller submits business details
 * (→ PENDING); an admin approves (→ VERIFIED, badge shows on the storefront) or
 * rejects (→ REJECTED, with a note). Status is denormalised on the tenant so the
 * storefront badge reads it from the already-resolved tenant. Admin reviews are
 * audited. v1 has no document upload — that's a later slice.
 */

/** The tenant's verification state (seller page + admin review). Tenant-scoped. */
export function getVerification(tenantId: string) {
  return prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      verificationStatus: true,
      verificationNote: true,
      verificationReviewNote: true,
      verificationSubmittedAt: true,
      verifiedAt: true,
    },
  });
}

/**
 * Seller submits / re-submits for verification → PENDING. Tenant-scoped via
 * updateMany. Clears any prior admin review note. A VERIFIED tenant can't
 * re-submit (no-op) — they're already verified.
 */
export function submitVerification(tenantId: string, note: string) {
  return prisma.tenant.updateMany({
    where: { id: tenantId, verificationStatus: { in: ["UNVERIFIED", "REJECTED"] } },
    data: {
      verificationStatus: "PENDING",
      verificationNote: note.slice(0, 2000),
      verificationReviewNote: null,
      verificationSubmittedAt: new Date(),
    },
  });
}

/** Admin approve/reject of a pending submission, audited. */
export function reviewVerification(input: {
  tenantId: string;
  decision: "VERIFIED" | "REJECTED";
  reviewNote?: string | null;
  adminEmail: string;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.tenant.update({
      where: { id: input.tenantId },
      data: {
        verificationStatus: input.decision,
        verificationReviewNote: input.reviewNote?.slice(0, 1000) ?? null,
        verifiedAt: input.decision === "VERIFIED" ? new Date() : null,
      },
    });
    await tx.adminAuditLog.create({
      data: {
        adminEmail: input.adminEmail,
        action: input.decision === "VERIFIED" ? "verification.approve" : "verification.reject",
        tenantId: input.tenantId,
        detail: input.reviewNote?.slice(0, 200) ?? null,
      },
    });
  });
}

/** Pending verification submissions (admin queue / notifications). */
export function listPendingVerifications(take = 20) {
  return prisma.tenant.findMany({
    where: { verificationStatus: "PENDING" },
    orderBy: { verificationSubmittedAt: "asc" },
    take,
    select: { id: true, username: true, name: true, verificationSubmittedAt: true },
  });
}

export function countPendingVerifications() {
  return prisma.tenant.count({ where: { verificationStatus: "PENDING" } });
}
