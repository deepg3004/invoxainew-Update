import { Prisma } from "@prisma/client";
import { prisma } from "./client";

/**
 * AI landing-page data access (C9). Pages are created only after Claude
 * generation succeeds AND the ₹149 wallet debit succeeds (see the app action).
 * Tenant-scoped throughout. `content` is opaque structured JSON here; the app
 * defines its shape and the tenant app renders it.
 */

export type CreateAiPageResult =
  | { ok: true; id: string }
  | { ok: false; reason: "slug_taken" };

/**
 * Create an AI page (no charge here — billing is handled separately by the
 * Feature Billing engine). `chargeRef` is null for free pages, or the feature-
 * charge reference when paid. Slug is unique per tenant; a clash is reported.
 */
export async function createAiPage(input: {
  tenantId: string;
  slug: string;
  title: string;
  brief: string;
  content: Prisma.InputJsonValue;
  chargeRef?: string | null;
}): Promise<CreateAiPageResult> {
  try {
    const page = await prisma.aiPage.create({
      data: {
        tenantId: input.tenantId,
        slug: input.slug,
        title: input.title,
        brief: input.brief,
        content: input.content,
        chargeRef: input.chargeRef ?? null,
      },
      select: { id: true },
    });
    return { ok: true, id: page.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, reason: "slug_taken" };
    }
    throw e;
  }
}

/** Tag a page with its feature-charge reference (after a paid generation). */
export function setAiPageChargeRef(id: string, chargeRef: string) {
  return prisma.aiPage.update({ where: { id }, data: { chargeRef } });
}

export type ChargeCreateResult =
  | { ok: true; id: string }
  | { ok: false; reason: "slug_taken" | "insufficient_funds" | "no_wallet" };

/**
 * Atomically charge the seller's wallet ₹149 AND create the page — or neither.
 *
 * Charge-on-success: the caller only invokes this after Claude generated the
 * content. Doing the debit and the insert in ONE transaction means a slug clash
 * never leaves the seller charged for a page that wasn't created, and the
 * balance check + debit can't race into a negative balance. `chargeRef` is the
 * wallet-debit idempotency key (unique on both the ledger row and the page).
 */
export async function chargeAndCreateAiPage(input: {
  tenantId: string;
  slug: string;
  title: string;
  brief: string;
  content: Prisma.InputJsonValue;
  pricePaise: number;
  chargeRef: string;
}): Promise<ChargeCreateResult> {
  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({
      where: { tenantId: input.tenantId },
    });
    if (!wallet) return { ok: false, reason: "no_wallet" };
    if (wallet.balancePaise < input.pricePaise) {
      return { ok: false, reason: "insufficient_funds" };
    }

    let pageId: string;
    try {
      const page = await tx.aiPage.create({
        data: {
          tenantId: input.tenantId,
          slug: input.slug,
          title: input.title,
          brief: input.brief,
          content: input.content,
          chargeRef: input.chargeRef,
        },
        select: { id: true },
      });
      pageId = page.id;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return { ok: false, reason: "slug_taken" };
      }
      throw e;
    }

    const balanceAfter = wallet.balancePaise - input.pricePaise;
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balancePaise: balanceAfter },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        tenantId: input.tenantId,
        direction: "DEBIT",
        amountPaise: input.pricePaise,
        balanceAfter,
        reason: "AI page generation",
        referenceType: "ai_page",
        referenceId: input.chargeRef,
      },
    });

    return { ok: true, id: pageId };
  });
}

/** A tenant's AI pages, newest first. Scoped by tenantId. */
export function listAiPages(tenantId: string) {
  return prisma.aiPage.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });
}

/** A published AI page by tenant+slug — the buyer-facing public lookup. */
export function getPublishedAiPage(tenantId: string, slug: string) {
  return prisma.aiPage.findFirst({
    where: { tenantId, slug, isPublished: true },
  });
}

/** Delete a tenant's own AI page (scoped). */
export function deleteAiPage(tenantId: string, id: string) {
  return prisma.aiPage.deleteMany({ where: { id, tenantId } });
}
