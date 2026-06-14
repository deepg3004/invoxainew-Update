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

// ── KYC documents (verification attachments) ──────────────────────────────────
//
// Supporting files for a verification submission, stored in the PRIVATE downloads
// bucket. `storageKey` is the object key, NEVER public — callers reveal a doc only
// via a short-lived signed URL (server-side) to the owning seller or an admin.
// Every read/write below is tenant-scoped.

const KYC_DOC_TYPES = ["identity", "business", "address", "other"] as const;
export type KycDocType = (typeof KYC_DOC_TYPES)[number];

export function isKycDocType(v: string): v is KycDocType {
  return (KYC_DOC_TYPES as readonly string[]).includes(v);
}

export function addKycDocument(input: {
  tenantId: string;
  docType: KycDocType;
  fileName: string;
  storageKey: string;
}) {
  return prisma.kycDocument.create({
    data: {
      tenantId: input.tenantId,
      docType: input.docType,
      fileName: input.fileName.slice(0, 200),
      storageKey: input.storageKey,
    },
    select: { id: true },
  });
}

/** A tenant's KYC documents, newest first. Used by BOTH the seller page (own
 *  tenant) and the admin review (admin passes the reviewed tenant's id). */
export function listKycDocuments(tenantId: string) {
  return prisma.kycDocument.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });
}

/** One KYC document scoped by tenant — so a seller/admin can only act on a doc
 *  that belongs to the tenant in context (returns the storageKey for signing or
 *  storage cleanup). */
export function getKycDocument(tenantId: string, id: string) {
  return prisma.kycDocument.findFirst({ where: { id, tenantId } });
}

/** Delete a KYC document row, tenant-scoped. (Storage object cleanup is the
 *  caller's job — it has the key from getKycDocument.) */
export function deleteKycDocument(tenantId: string, id: string) {
  return prisma.kycDocument.deleteMany({ where: { id, tenantId } });
}
