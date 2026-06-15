import { prisma } from "./client";

/**
 * Growth G1.1 — post-purchase one-time offers (OTO).
 *
 * MONEY MODEL (hard rule): an OTO carries NO buyer money here. This module is the
 * seller-managed CATALOG of offers only (Part 1). When a buyer accepts an OTO
 * (Part 2), a fresh BuyerPayment is created on the SELLER's own gateway and the
 * PAID transition runs through the same markBuyerPaymentPaid claim — so commission
 * is taken from the seller wallet exactly as for any sale, and a refresh can't
 * double-charge. The offer PRICE is always recomputed server-side from the offer
 * product + discountBps; the client's claimed price is never trusted.
 *
 * Tenant isolation: every read/write is scoped by tenantId. The offer/trigger
 * products are re-validated as belonging to the same tenant on create/update, so a
 * seller can't attach another tenant's product to their OTO.
 */

// discountBps is clamped into [0, 10000] (0%–100%). 10000 would make the offer free;
// Part 2's charge path additionally enforces Razorpay's minimum chargeable amount.
const MAX_BPS = 10000;

export interface UpsellInput {
  offerProductId: string;
  triggerProductId?: string | null;
  headline: string;
  blurb?: string | null;
  discountBps?: number;
  active?: boolean;
  sortOrder?: number;
}

export type SaveUpsellResult =
  | { ok: true; id: string }
  | { ok: false; reason: "offer_not_found" | "trigger_not_found" | "not_owned" };

function clampBps(v: number | undefined): number {
  if (!Number.isFinite(v ?? NaN)) return 0;
  return Math.max(0, Math.min(MAX_BPS, Math.floor(v as number)));
}

/** Verify a product id belongs to this tenant (offer/trigger must be the seller's own). */
async function ownsProduct(tenantId: string, productId: string): Promise<boolean> {
  const p = await prisma.product.findFirst({
    where: { id: productId, tenantId },
    select: { id: true },
  });
  return Boolean(p);
}

export async function createUpsell(
  tenantId: string,
  input: UpsellInput,
): Promise<SaveUpsellResult> {
  if (!(await ownsProduct(tenantId, input.offerProductId))) {
    return { ok: false, reason: "offer_not_found" };
  }
  if (input.triggerProductId && !(await ownsProduct(tenantId, input.triggerProductId))) {
    return { ok: false, reason: "trigger_not_found" };
  }
  const row = await prisma.upsell.create({
    data: {
      tenantId,
      offerProductId: input.offerProductId,
      triggerProductId: input.triggerProductId ?? null,
      headline: input.headline,
      blurb: input.blurb ?? null,
      discountBps: clampBps(input.discountBps),
      active: input.active ?? true,
      sortOrder: input.sortOrder ?? 0,
    },
    select: { id: true },
  });
  return { ok: true, id: row.id };
}

/** A seller's OTOs (with the offer + trigger product titles for the list). Scoped. */
export function listUpsells(tenantId: string, opts: { skip?: number; take?: number } = {}) {
  return prisma.upsell.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    skip: opts.skip,
    take: opts.take,
    include: {
      offerProduct: { select: { id: true, title: true, pricePaise: true } },
      triggerProduct: { select: { id: true, title: true } },
    },
  });
}

export function countUpsells(tenantId: string) {
  return prisma.upsell.count({ where: { tenantId } });
}

/** One OTO owned by this tenant (seller scope), for the edit page. */
export function getUpsellById(tenantId: string, id: string) {
  return prisma.upsell.findFirst({ where: { id, tenantId } });
}

export async function updateUpsell(
  tenantId: string,
  id: string,
  input: UpsellInput,
): Promise<SaveUpsellResult> {
  // Confirm ownership of the row first so the response distinguishes not-owned.
  const owned = await prisma.upsell.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!owned) return { ok: false, reason: "not_owned" };
  if (!(await ownsProduct(tenantId, input.offerProductId))) {
    return { ok: false, reason: "offer_not_found" };
  }
  if (input.triggerProductId && !(await ownsProduct(tenantId, input.triggerProductId))) {
    return { ok: false, reason: "trigger_not_found" };
  }
  await prisma.upsell.updateMany({
    where: { id, tenantId },
    data: {
      offerProductId: input.offerProductId,
      triggerProductId: input.triggerProductId ?? null,
      headline: input.headline,
      blurb: input.blurb ?? null,
      discountBps: clampBps(input.discountBps),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
  });
  return { ok: true, id };
}

export function setUpsellActive(tenantId: string, id: string, active: boolean) {
  return prisma.upsell.updateMany({ where: { id, tenantId }, data: { active } });
}

export function deleteUpsell(tenantId: string, id: string) {
  return prisma.upsell.deleteMany({ where: { id, tenantId } });
}

/** Published products a seller can pick as an OTO offer/trigger (id + title + price). */
export function listProductOptionsForUpsell(tenantId: string) {
  return prisma.product.findMany({
    where: { tenantId, status: "PUBLISHED" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: { id: true, title: true, pricePaise: true },
  });
}

// ── Part 2: the OTO money path ───────────────────────────────────────────────

// Razorpay can't create a ₹0 order, so the OTO price is clamped to leave at least
// this much to pay — mirrors the coupon floor in coupons.ts.
const MIN_CHARGE_PAISE = 100; // ₹1

/**
 * Server-trusted OTO price: the offer product's price minus the OTO-only discount,
 * clamped into [MIN_CHARGE_PAISE, price]. PURE + exported so it can be unit-tested —
 * the client NEVER supplies the OTO amount; it's always recomputed from the DB here.
 */
export function otoOfferPricePaise(productPricePaise: number, discountBps: number): number {
  const price = Math.max(0, Math.floor(productPricePaise));
  const bps = Math.max(0, Math.min(10000, Math.floor(discountBps)));
  const discounted = price - Math.floor((price * bps) / 10000);
  // Never below the gateway minimum, and never above the product's own price.
  return Math.min(price, Math.max(MIN_CHARGE_PAISE, discounted));
}

export type OtoOffer = {
  upsellId: string;
  headline: string;
  blurb: string | null;
  offerProductId: string;
  offerProductTitle: string;
  listPricePaise: number;
  pricePaise: number;
};

/**
 * The OTO to show on a parent order's success page, or null. Resolves the parent
 * order (must be PAID), then the best-matching ACTIVE upsell of its tenant — a
 * specific-trigger offer (the bought product) is preferred over an any-purchase one.
 * Skips an offer of the same product just bought, unpublished offers, and any OTO the
 * buyer already PAID for this parent (idempotency-aware UI). Tenant-scoped via parent.
 */
export async function getActiveOtoForOrder(
  parentRazorpayOrderId: string,
): Promise<OtoOffer | null> {
  const parent = await prisma.buyerPayment.findUnique({
    where: { razorpayOrderId: parentRazorpayOrderId },
    select: { id: true, tenantId: true, status: true, productId: true },
  });
  if (!parent || parent.status !== "PAID") return null;

  const candidates = await prisma.upsell.findMany({
    where: {
      tenantId: parent.tenantId,
      active: true,
      OR: [
        ...(parent.productId ? [{ triggerProductId: parent.productId }] : []),
        { triggerProductId: null },
      ],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      offerProduct: { select: { id: true, title: true, pricePaise: true, status: true } },
    },
  });
  // Prefer a specific-trigger match over an any-purchase one (don't rely on SQL NULL
  // ordering — partition in JS).
  const ordered = [
    ...candidates.filter((u) => u.triggerProductId === parent.productId),
    ...candidates.filter((u) => u.triggerProductId === null),
  ];

  for (const u of ordered) {
    if (u.offerProductId === parent.productId) continue; // don't re-sell what they bought
    if (u.offerProduct.status !== "PUBLISHED") continue;
    const existing = await prisma.buyerPayment.findUnique({
      where: { parentPaymentId_upsellId: { parentPaymentId: parent.id, upsellId: u.id } },
      select: { status: true },
    });
    if (existing && existing.status === "PAID") continue; // already accepted → next
    return {
      upsellId: u.id,
      headline: u.headline,
      blurb: u.blurb,
      offerProductId: u.offerProductId,
      offerProductTitle: u.offerProduct.title,
      listPricePaise: u.offerProduct.pricePaise,
      pricePaise: otoOfferPricePaise(u.offerProduct.pricePaise, u.discountBps),
    };
  }
  return null;
}

/** Existing OTO order for this parent×upsell (idempotency lookup for startOtoCheckout). */
export function findOtoOrder(parentPaymentId: string, upsellId: string) {
  return prisma.buyerPayment.findUnique({
    where: { parentPaymentId_upsellId: { parentPaymentId, upsellId } },
    select: { id: true, razorpayOrderId: true, status: true, amountPaise: true },
  });
}

export type OtoContext = {
  parent: {
    id: string;
    tenantId: string;
    productId: string | null;
    buyerProfileId: string | null;
    buyerEmail: string | null;
    buyerContact: string | null;
  };
  offerProductId: string;
  title: string;
  pricePaise: number;
};

/**
 * Resolve a PAID parent order + an active upsell of its tenant into everything the
 * checkout action needs (server-trusted price + buyer attribution copied from the
 * parent). Null = not eligible (parent not paid / upsell gone / offer unpublished /
 * offer == bought product). The client supplies only ids — never the amount.
 */
export async function resolveOtoContext(
  parentRazorpayOrderId: string,
  upsellId: string,
): Promise<OtoContext | null> {
  const parent = await prisma.buyerPayment.findUnique({
    where: { razorpayOrderId: parentRazorpayOrderId },
    select: {
      id: true,
      tenantId: true,
      status: true,
      productId: true,
      buyerProfileId: true,
      buyerEmail: true,
      buyerContact: true,
    },
  });
  if (!parent || parent.status !== "PAID") return null;

  const upsell = await prisma.upsell.findFirst({
    where: { id: upsellId, tenantId: parent.tenantId, active: true },
    include: { offerProduct: { select: { id: true, title: true, pricePaise: true, status: true } } },
  });
  if (!upsell || upsell.offerProduct.status !== "PUBLISHED") return null;
  if (upsell.offerProductId === parent.productId) return null;

  return {
    parent: {
      id: parent.id,
      tenantId: parent.tenantId,
      productId: parent.productId,
      buyerProfileId: parent.buyerProfileId,
      buyerEmail: parent.buyerEmail,
      buyerContact: parent.buyerContact,
    },
    offerProductId: upsell.offerProductId,
    title: upsell.offerProduct.title,
    pricePaise: otoOfferPricePaise(upsell.offerProduct.pricePaise, upsell.discountBps),
  };
}
