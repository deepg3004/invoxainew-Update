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

export type CreateProductResult =
  | { ok: true; id: string }
  | { ok: false; reason: "slug_taken" };

export async function createProduct(input: {
  tenantId: string;
  slug: string;
  title: string;
  description?: string | null;
  pricePaise: number;
  imageUrl?: string | null;
  kind: ProductKind;
  stockQty?: number | null;
  sortOrder?: number;
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
        imageUrl: input.imageUrl ?? null,
        kind: input.kind,
        stockQty: input.stockQty ?? null,
        sortOrder: input.sortOrder ?? 0,
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
  });
}

/** A single PUBLISHED product by tenant+slug — the public product page. */
export function getPublishedProduct(tenantId: string, slug: string) {
  return prisma.product.findFirst({
    where: { tenantId, slug, status: "PUBLISHED" },
  });
}

/** A PUBLISHED product by id — used by the buyer checkout action so the price
 *  and stock are read server-trusted from the DB, never from the client. */
export function getPublishedProductById(id: string) {
  return prisma.product.findFirst({ where: { id, status: "PUBLISHED" } });
}

export function updateProduct(
  tenantId: string,
  id: string,
  data: {
    title: string;
    description?: string | null;
    pricePaise: number;
    imageUrl?: string | null;
    kind: ProductKind;
    stockQty?: number | null;
    sortOrder?: number;
  },
) {
  // Scope the update to the owner via updateMany (where includes tenantId).
  return prisma.product.updateMany({
    where: { id, tenantId },
    data: {
      title: data.title,
      description: data.description ?? null,
      pricePaise: data.pricePaise,
      imageUrl: data.imageUrl ?? null,
      kind: data.kind,
      stockQty: data.stockQty ?? null,
      sortOrder: data.sortOrder ?? 0,
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
