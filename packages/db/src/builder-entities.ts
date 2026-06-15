import { prisma } from "./client";

/**
 * Builder Part 3 — entity-bound widget resolution (db layer).
 *
 * The public AI-page renderer calls these to turn the entity ids stored in
 * course/leadForm/paymentButton blocks into live card data (products reuse the
 * existing listPublishedProductsByIds). EVERY query is TENANT-SCOPED and limited
 * to PUBLISHED/ACTIVE rows, so a block that references another tenant's id (or a
 * draft/deleted entity) resolves to nothing and the widget simply renders empty
 * — the trust boundary for entity refs. Reads only; never returns gated content.
 */

export function getPublishedCoursesByIds(tenantId: string, ids: string[]) {
  if (ids.length === 0) return Promise.resolve([]);
  return prisma.course.findMany({
    where: { tenantId, status: "PUBLISHED", id: { in: ids } },
    select: { id: true, slug: true, title: true, pricePaise: true, compareAtPaise: true, imageUrl: true },
  });
}

export function getActivePaymentPagesByIds(tenantId: string, ids: string[]) {
  if (ids.length === 0) return Promise.resolve([]);
  return prisma.paymentPage.findMany({
    where: { tenantId, isActive: true, id: { in: ids } },
    select: { id: true, slug: true, title: true, amountPaise: true, compareAtPaise: true, imageUrl: true },
  });
}

export function getPublishedLeadFormsByIds(tenantId: string, ids: string[]) {
  if (ids.length === 0) return Promise.resolve([]);
  return prisma.leadForm.findMany({
    where: { tenantId, status: "PUBLISHED", id: { in: ids } },
    select: { id: true, slug: true, title: true },
  });
}
