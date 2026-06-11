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
}) {
  const data = {
    metaPixelId: input.metaPixelId,
    ga4MeasurementId: input.ga4MeasurementId,
    googleAdsId: input.googleAdsId,
    gtmId: input.gtmId,
  };
  return prisma.tenantTracking.upsert({
    where: { tenantId: input.tenantId },
    create: { tenantId: input.tenantId, ...data },
    update: data,
  });
}
