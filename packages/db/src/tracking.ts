import { prisma } from "./client";

/**
 * Per-tenant ads/analytics tracking IDs (Final Plan §21). Read server-side on
 * the seller's public pages to inject the right pixels; written by the seller in
 * their dashboard. Tenant-scoped.
 */

export function getTenantTracking(tenantId: string) {
  return prisma.tenantTracking.findUnique({ where: { tenantId } });
}

export function upsertTenantTracking(input: {
  tenantId: string;
  metaPixelId: string | null;
  ga4MeasurementId: string | null;
  googleAdsId: string | null;
  gtmId: string | null;
  socialProofEnabled?: boolean;
}) {
  const data = {
    metaPixelId: input.metaPixelId,
    ga4MeasurementId: input.ga4MeasurementId,
    googleAdsId: input.googleAdsId,
    gtmId: input.gtmId,
    // Only touch the toggle when the caller provided it, so the create-default of
    // `true` and an existing value aren't clobbered by a pixel-only save.
    ...(input.socialProofEnabled !== undefined
      ? { socialProofEnabled: input.socialProofEnabled }
      : {}),
  };
  return prisma.tenantTracking.upsert({
    where: { tenantId: input.tenantId },
    create: { tenantId: input.tenantId, ...data },
    update: data,
  });
}
