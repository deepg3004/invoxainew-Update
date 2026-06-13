import { prisma } from "./client";

/** A tenant's manual-UPI config (one per tenant), or null. Scoped. */
export function getSellerUpi(tenantId: string) {
  return prisma.sellerUpi.findUnique({ where: { tenantId } });
}

/** A tenant's UPI config only if it's enabled (for buyer checkout). Scoped. */
export async function getEnabledSellerUpi(tenantId: string) {
  const upi = await prisma.sellerUpi.findUnique({ where: { tenantId } });
  return upi && upi.enabled ? upi : null;
}

/** Create or update the tenant's manual-UPI method + auto-confirm config. Scoped. */
export function upsertSellerUpi(
  tenantId: string,
  input: {
    upiId: string;
    displayName?: string | null;
    enabled?: boolean;
    autoConfirm?: boolean;
    autoConfirmMaxPaise?: number | null;
    sessionTtlMinutes?: number;
  },
) {
  // Only set config fields the caller provided, so create-defaults (autoConfirm
  // true, ttl 10) and existing values are preserved on a partial update.
  const data = {
    upiId: input.upiId.trim(),
    displayName: input.displayName?.trim() || null,
    enabled: input.enabled ?? true,
    ...(input.autoConfirm !== undefined ? { autoConfirm: input.autoConfirm } : {}),
    ...(input.autoConfirmMaxPaise !== undefined
      ? { autoConfirmMaxPaise: input.autoConfirmMaxPaise }
      : {}),
    ...(input.sessionTtlMinutes !== undefined
      ? { sessionTtlMinutes: input.sessionTtlMinutes }
      : {}),
  };
  return prisma.sellerUpi.upsert({
    where: { tenantId },
    create: { tenantId, ...data },
    update: data,
  });
}

/** Remove the tenant's manual-UPI method. Scoped. */
export function deleteSellerUpi(tenantId: string) {
  return prisma.sellerUpi.deleteMany({ where: { tenantId } });
}
