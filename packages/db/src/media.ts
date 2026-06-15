import { prisma } from "./client";

/**
 * Media library (cloud storage). A FileAsset is the catalog row for a file stored
 * in the private downloads bucket under the tenant's key prefix. This module is
 * the source of truth for storage usage. Every read/write is tenant-scoped. The
 * actual upload/delete/sign of the object live in the app's server actions (they
 * call @invoxai/auth/server); this is pure DB bookkeeping.
 */

export function createFileAsset(input: {
  tenantId: string;
  key: string;
  name: string;
  sizeBytes: number;
  contentType: string;
}) {
  return prisma.fileAsset.create({
    data: {
      tenantId: input.tenantId,
      key: input.key,
      name: input.name,
      sizeBytes: input.sizeBytes,
      contentType: input.contentType,
    },
    select: { id: true },
  });
}

/** A tenant's files, newest first. Scoped by tenantId. */
export function listFileAssets(tenantId: string) {
  return prisma.fileAsset.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

/** One file owned by this tenant (for download/delete). Returns null if not theirs. */
export function getFileAsset(tenantId: string, id: string) {
  return prisma.fileAsset.findFirst({ where: { id, tenantId } });
}

/** Delete the catalog row (tenant-scoped). The caller removes the object first. */
export async function deleteFileAsset(tenantId: string, id: string): Promise<boolean> {
  const res = await prisma.fileAsset.deleteMany({ where: { id, tenantId } });
  return res.count === 1;
}

/** Total bytes a tenant is using (drives the storage usage bar + upload gate). */
export async function tenantStorageBytes(tenantId: string): Promise<number> {
  const agg = await prisma.fileAsset.aggregate({
    where: { tenantId },
    _sum: { sizeBytes: true },
  });
  return agg._sum.sizeBytes ?? 0;
}
