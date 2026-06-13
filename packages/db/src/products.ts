import { Prisma, type ProductKind, type ProductStatus } from "@prisma/client";
import { prisma } from "./client";

/**
 * Store / product catalog (Final Plan §9, slice 1 = catalog + seller CRUD).
 *
 * MONEY MODEL (hard rule): products carry NO buyer money here. Slice 2 adds the
 * storefront + checkout, where a buyer pays on the SELLER's own gateway (money
 * settles seller-direct, never through InvoxAI) and commission is taken from the
 * seller's wallet — exactly like payment pages (see payments.ts). This file is
 * just the catalog: seller-scoped CRUD + a published lookup for the storefront.
 *
 * Tenant isolation: every read/write is scoped by tenantId; the public lookups
 * additionally require status = PUBLISHED so drafts/archived items stay private.
 */

/**
 * Public-storefront projection. Lists EXACTLY the fields the public Server
 * Components and the buyer checkout/cart pricing actions read — and deliberately
 * NOT the gated, post-purchase-only fields: `downloadKey`/`downloadName` (the
 * private storage object key + filename) and `accessUrl`. Those are revealed to a
 * buyer solely on a PAID order (see getBuyerOrder), never on a public page.
 *
 * Defense in depth: every current public consumer already projects an explicit
 * allow-list before anything reaches a client component, so nothing leaks today.
 * Pinning the select here means a FUTURE edit that forwards a whole product row
 * to a client component still cannot accidentally ship the storage key.
 *
 * Prisma.validator preserves the literal so query result types stay precise.
 */
const PUBLIC_PRODUCT_SELECT = Prisma.validator<Prisma.ProductSelect>()({
  id: true,
  tenantId: true,
  slug: true,
  title: true,
  description: true,
  pricePaise: true,
  compareAtPaise: true,
  imageUrl: true,
  kind: true,
  stockQty: true,
  updatedAt: true,
});

export type CreateProductResult =
  | { ok: true; id: string }
  | { ok: false; reason: "slug_taken" };

export async function createProduct(input: {
  tenantId: string;
  slug: string;
  title: string;
  description?: string | null;
  pricePaise: number;
  compareAtPaise?: number | null;
  bumpEnabled?: boolean;
  bumpBlurb?: string | null;
  imageUrl?: string | null;
  kind: ProductKind;
  stockQty?: number | null;
  sortOrder?: number;
  accessUrl?: string | null;
  downloadKey?: string | null;
  downloadName?: string | null;
  status?: ProductStatus;
}): Promise<CreateProductResult> {
  try {
    const product = await prisma.product.create({
      data: {
        tenantId: input.tenantId,
        slug: input.slug,
        title: input.title,
        description: input.description ?? null,
        pricePaise: input.pricePaise,
        compareAtPaise: input.compareAtPaise ?? null,
        bumpEnabled: input.bumpEnabled ?? false,
        bumpBlurb: input.bumpBlurb ?? null,
        downloadKey: input.downloadKey ?? null,
        downloadName: input.downloadName ?? null,
        imageUrl: input.imageUrl ?? null,
        kind: input.kind,
        stockQty: input.stockQty ?? null,
        sortOrder: input.sortOrder ?? 0,
        accessUrl: input.accessUrl ?? null,
        status: input.status ?? "DRAFT",
      },
      select: { id: true },
    });
    return { ok: true, id: product.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, reason: "slug_taken" };
    }
    throw e;
  }
}

/** A seller's products, newest first. Scoped by tenantId. */
export function listProducts(tenantId: string) {
  return prisma.product.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
}

/** A product owned by this tenant (seller scope). */
export function getProductById(tenantId: string, id: string) {
  return prisma.product.findFirst({ where: { id, tenantId } });
}

/** The PUBLISHED catalog for a tenant — the public storefront listing. */
export function listPublishedProducts(tenantId: string) {
  return prisma.product.findMany({
    where: { tenantId, status: "PUBLISHED" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: PUBLIC_PRODUCT_SELECT,
  });
}

/** A single PUBLISHED product by tenant+slug — the public product page. */
export function getPublishedProduct(tenantId: string, slug: string) {
  return prisma.product.findFirst({
    where: { tenantId, slug, status: "PUBLISHED" },
    select: PUBLIC_PRODUCT_SELECT,
  });
}

/** A PUBLISHED product by id WITHIN a tenant — used by the buyer checkout action
 *  so the price and stock are read server-trusted from the DB, never from the
 *  client. Scoped by tenantId (the host-resolved store): a buyer on store B can
 *  never check out store A's product by passing a foreign id — the lookup simply
 *  returns null, mirroring listPublishedProductsByIds' tenant scoping. */
export function getPublishedProductById(tenantId: string, id: string) {
  return prisma.product.findFirst({
    where: { id, tenantId, status: "PUBLISHED" },
    select: PUBLIC_PRODUCT_SELECT,
  });
}

/** PUBLISHED products by id for one tenant — a single batched lookup for cart
 *  pricing, replacing an N+1 of getPublishedProductById per line. Tenant-scoped
 *  in the query, so a cart can never pull in another seller's product. */
export function listPublishedProductsByIds(tenantId: string, ids: string[]) {
  return prisma.product.findMany({
    where: { tenantId, id: { in: ids }, status: "PUBLISHED" },
    select: PUBLIC_PRODUCT_SELECT,
  });
}

export function updateProduct(
  tenantId: string,
  id: string,
  data: {
    title: string;
    description?: string | null;
    pricePaise: number;
    compareAtPaise?: number | null;
    bumpEnabled?: boolean;
    bumpBlurb?: string | null;
    imageUrl?: string | null;
    kind: ProductKind;
    stockQty?: number | null;
    sortOrder?: number;
    accessUrl?: string | null;
    downloadKey?: string | null;
    downloadName?: string | null;
  },
) {
  // Scope the update to the owner via updateMany (where includes tenantId).
  return prisma.product.updateMany({
    where: { id, tenantId },
    data: {
      title: data.title,
      description: data.description ?? null,
      pricePaise: data.pricePaise,
      compareAtPaise: data.compareAtPaise ?? null,
      bumpEnabled: data.bumpEnabled ?? false,
      bumpBlurb: data.bumpBlurb ?? null,
      downloadKey: data.downloadKey ?? null,
      downloadName: data.downloadName ?? null,
      imageUrl: data.imageUrl ?? null,
      kind: data.kind,
      stockQty: data.stockQty ?? null,
      sortOrder: data.sortOrder ?? 0,
      accessUrl: data.accessUrl ?? null,
    },
  });
}

/** Move a product between DRAFT / PUBLISHED / ARCHIVED (seller-scoped). */
export function setProductStatus(
  tenantId: string,
  id: string,
  status: ProductStatus,
) {
  return prisma.product.updateMany({
    where: { id, tenantId },
    data: { status },
  });
}

/**
 * Paid-order counts per product — single-product orders + cart line items — for
 * "bestseller" badges on the storefront. Batched (two grouped queries), tenant-
 * scoped. Returns a productId→count map (products with no sales are absent).
 */
export async function getProductSalesCounts(
  tenantId: string,
  productIds: string[],
): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();
  const [single, lines] = await Promise.all([
    prisma.buyerPayment.groupBy({
      by: ["productId"],
      where: { tenantId, status: "PAID", productId: { in: productIds } },
      _count: { _all: true },
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: { productId: { in: productIds }, buyerPayment: { tenantId, status: "PAID" } },
      _count: { _all: true },
    }),
  ]);
  const map = new Map<string, number>();
  for (const r of single) {
    if (r.productId) map.set(r.productId, (map.get(r.productId) ?? 0) + r._count._all);
  }
  for (const r of lines) {
    if (r.productId) map.set(r.productId, (map.get(r.productId) ?? 0) + r._count._all);
  }
  return map;
}

/**
 * The store's order-bump add-on (or null): the first PUBLISHED, bump-enabled,
 * in-stock product by sortOrder. Used both to render the bump at checkout and as
 * the server-trusted source for its price/stock when a buyer opts in. Scoped.
 */
export function getOrderBumpProduct(tenantId: string) {
  return prisma.product.findFirst({
    where: {
      tenantId,
      status: "PUBLISHED",
      bumpEnabled: true,
      OR: [{ stockQty: null }, { stockQty: { gt: 0 } }],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      pricePaise: true,
      compareAtPaise: true,
      imageUrl: true,
      stockQty: true,
      bumpBlurb: true,
    },
  });
}
