import { Prisma } from "@prisma/client";
import { prisma } from "./client";
import { lockWalletForUpdate } from "./wallet";

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

/** Tag a page with its feature-charge reference (after a paid generation).
 *  Tenant-scoped like its siblings (updateAiPageContent/setAiPagePublished) so
 *  the db layer self-enforces ownership rather than trusting the passed id (F2). */
export function setAiPageChargeRef(tenantId: string, id: string, chargeRef: string) {
  return prisma.aiPage.updateMany({ where: { id, tenantId }, data: { chargeRef } });
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
    // Lock the wallet row FOR UPDATE so the balance check + debit can't lose a
    // concurrent fee on the same wallet (lost-update → money drift). A bare
    // findUnique read-then-write would let two concurrent charges both read the
    // same starting balance and silently drop one debit.
    const wallet = await lockWalletForUpdate(tx, input.tenantId);
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

/** A tenant's own AI page by id — for the seller block editor. Scoped. */
export function getAiPageForOwner(tenantId: string, id: string) {
  return prisma.aiPage.findFirst({ where: { id, tenantId } });
}

/** Save edited block content (and title) for a tenant's own page. Scoped via
 *  updateMany so another tenant's id can't be written. `content` is the
 *  validated {title, blocks} JSON (sanitized app-side before this call). */
export function updateAiPageContent(
  tenantId: string,
  id: string,
  title: string,
  content: Prisma.InputJsonValue,
) {
  return prisma.aiPage.updateMany({
    where: { id, tenantId },
    data: { title, content },
  });
}

/** Rename a tenant's own AI page (scoped). Updates the `title` column AND the
 *  content JSON's title (the public renderer reads content.title), so a quick
 *  rename from the list keeps both in sync without opening the editor. */
export async function renameAiPage(tenantId: string, id: string, title: string) {
  const page = await prisma.aiPage.findFirst({
    where: { id, tenantId },
    select: { content: true },
  });
  if (!page) return { count: 0 };
  const base =
    page.content && typeof page.content === "object" && !Array.isArray(page.content)
      ? (page.content as Record<string, unknown>)
      : {};
  const content = { ...base, title } as Prisma.InputJsonValue;
  return prisma.aiPage.updateMany({ where: { id, tenantId }, data: { title, content } });
}

/** Publish / unpublish a tenant's own AI page (scoped). Unpublishing takes it
 *  offline immediately — getPublishedAiPage filters on isPublished — without
 *  deleting it, so it can be brought back. */
export function setAiPagePublished(tenantId: string, id: string, isPublished: boolean) {
  return prisma.aiPage.updateMany({
    where: { id, tenantId },
    data: { isPublished },
  });
}

/** Delete a tenant's own AI page (scoped). */
export function deleteAiPage(tenantId: string, id: string) {
  return prisma.aiPage.deleteMany({ where: { id, tenantId } });
}

const KEEP_VERSIONS = 20;

/** Snapshot a page's content into version history, then prune to the latest 20.
 *  Best-effort — callers ignore failures so history never blocks a save. */
export async function recordAiPageVersion(
  tenantId: string,
  aiPageId: string,
  content: Prisma.InputJsonValue,
) {
  await prisma.aiPageVersion.create({ data: { aiPageId, tenantId, content } });
  const stale = await prisma.aiPageVersion.findMany({
    where: { aiPageId, tenantId },
    orderBy: { createdAt: "desc" },
    skip: KEEP_VERSIONS,
    select: { id: true },
  });
  if (stale.length) {
    await prisma.aiPageVersion.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
  }
}

/** A page's version snapshots, newest first. Scoped by tenant + page. */
export function listAiPageVersions(tenantId: string, aiPageId: string, take = KEEP_VERSIONS) {
  return prisma.aiPageVersion.findMany({
    where: { aiPageId, tenantId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, createdAt: true },
  });
}

/** One version's full content, scoped by tenant + page (for restore). */
export function getAiPageVersion(tenantId: string, aiPageId: string, versionId: string) {
  return prisma.aiPageVersion.findFirst({
    where: { id: versionId, aiPageId, tenantId },
  });
}
