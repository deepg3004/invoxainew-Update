import { Prisma } from "@prisma/client";
import { prisma } from "./client";

/**
 * Growth G1.6 — A/B tests on payment pages (db layer).
 *
 * Variant A is the page's own title/description; variant B overrides them. Counters
 * (views/conversions per variant) are advisory — bumped by the public /api/exp beacon,
 * like page-views. NO money flows through here. Tenant isolation: seller reads/writes
 * are scoped by tenantId (and re-check page ownership on create); the public serve +
 * counter path is keyed by paymentPageId / experiment id only.
 */

export type ExperimentVariant = "A" | "B";

export type CreateExperimentResult =
  | { ok: true; id: string }
  | { ok: false; reason: "page_not_found" | "exists" };

/** Start an A/B test on a payment page (the seller owns the page). One per page. */
export async function createExperiment(
  tenantId: string,
  input: { paymentPageId: string; variantBTitle: string; variantBDescription?: string | null },
): Promise<CreateExperimentResult> {
  const page = await prisma.paymentPage.findFirst({
    where: { id: input.paymentPageId, tenantId },
    select: { id: true },
  });
  if (!page) return { ok: false, reason: "page_not_found" };
  try {
    const row = await prisma.pageExperiment.create({
      data: {
        tenantId,
        paymentPageId: input.paymentPageId,
        variantBTitle: input.variantBTitle,
        variantBDescription: input.variantBDescription ?? null,
      },
      select: { id: true },
    });
    return { ok: true, id: row.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, reason: "exists" };
    }
    throw e;
  }
}

/** The seller's experiments with the tested page's title. Scoped. */
export function listExperiments(tenantId: string) {
  return prisma.pageExperiment.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    include: { paymentPage: { select: { title: true, slug: true } } },
  });
}

export function getExperimentById(tenantId: string, id: string) {
  return prisma.pageExperiment.findFirst({
    where: { id, tenantId },
    include: { paymentPage: { select: { title: true, slug: true } } },
  });
}

/** The RUNNING experiment for a payment page (public serve path), or null. */
export function getRunningExperimentForPage(paymentPageId: string) {
  return prisma.pageExperiment.findFirst({
    where: { paymentPageId, status: "RUNNING" },
    select: { id: true, variantBTitle: true, variantBDescription: true },
  });
}

export function stopExperiment(tenantId: string, id: string) {
  return prisma.pageExperiment.updateMany({
    where: { id, tenantId },
    data: { status: "STOPPED" },
  });
}

export function deleteExperiment(tenantId: string, id: string) {
  return prisma.pageExperiment.deleteMany({ where: { id, tenantId } });
}

/**
 * Bump a variant's view or conversion counter (public beacon path). Best-effort,
 * RUNNING-only, keyed by experiment id + variant. The increment is atomic; an unknown
 * id / stopped test simply matches no rows. Advisory data, never a money/grant path.
 */
export async function incrementExperiment(
  id: string,
  variant: ExperimentVariant,
  kind: "view" | "conversion",
): Promise<void> {
  const field =
    kind === "view"
      ? variant === "A"
        ? "aViews"
        : "bViews"
      : variant === "A"
        ? "aConversions"
        : "bConversions";
  await prisma.pageExperiment.updateMany({
    where: { id, status: "RUNNING" },
    data: { [field]: { increment: 1 } },
  });
}

/** Payment pages a seller can start an experiment on (not already running one). */
export function listPagesForExperiment(tenantId: string) {
  return prisma.paymentPage.findMany({
    where: { tenantId, experiment: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true },
  });
}
