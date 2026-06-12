"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createProduct,
  updateProduct,
  setProductStatus,
  getSellerGateway,
  logActivity,
  type ProductKind,
  type ProductStatus,
} from "@invoxai/db";
import { rupeeStringToPaise } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";

export type ProductFormState = { error?: string };

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;
const KINDS: ProductKind[] = ["DIGITAL", "PHYSICAL", "SERVICE"];

interface ParsedProduct {
  title: string;
  description: string | null;
  pricePaise: number;
  imageUrl: string | null;
  kind: ProductKind;
  stockQty: number | null;
  sortOrder: number;
  accessUrl: string | null;
}

function parseProductFields(
  form: FormData,
): { ok: true; value: ParsedProduct } | { ok: false; message: string } {
  const title = String(form.get("title") ?? "").trim();
  if (!title) return { ok: false, message: "Title is required." };

  const price = rupeeStringToPaise(String(form.get("price") ?? ""));
  if (!price.ok) return { ok: false, message: `Price: ${price.message}` };
  if (price.paise <= 0) return { ok: false, message: "Price must be greater than ₹0." };

  const kindRaw = String(form.get("kind") ?? "DIGITAL");
  const kind = KINDS.includes(kindRaw as ProductKind)
    ? (kindRaw as ProductKind)
    : "DIGITAL";

  const imageRaw = String(form.get("imageUrl") ?? "").trim();
  if (imageRaw && !/^https?:\/\/\S+$/.test(imageRaw)) {
    return { ok: false, message: "Image URL must start with http:// or https://" };
  }

  // Blank stock = unlimited. A number must be a non-negative integer.
  const stockRaw = String(form.get("stockQty") ?? "").trim();
  let stockQty: number | null = null;
  if (stockRaw) {
    const n = Number(stockRaw);
    if (!Number.isInteger(n) || n < 0) {
      return { ok: false, message: "Stock must be a whole number (or blank for unlimited)." };
    }
    stockQty = n;
  }

  // Display order: lower shows first on the storefront. Blank = 0.
  const orderRaw = String(form.get("sortOrder") ?? "").trim();
  let sortOrder = 0;
  if (orderRaw) {
    const n = Number(orderRaw);
    if (!Number.isInteger(n)) {
      return { ok: false, message: "Display order must be a whole number." };
    }
    sortOrder = n;
  }

  const accessRaw = String(form.get("accessUrl") ?? "").trim();
  if (accessRaw && !/^https?:\/\/\S+$/.test(accessRaw)) {
    return { ok: false, message: "Access link must start with http:// or https://" };
  }

  const description = String(form.get("description") ?? "").trim() || null;
  return {
    ok: true,
    value: {
      title,
      description,
      pricePaise: price.paise,
      imageUrl: imageRaw || null,
      kind,
      stockQty,
      sortOrder,
      accessUrl: accessRaw || null,
    },
  };
}

export async function createProductAction(
  _prev: ProductFormState,
  form: FormData,
): Promise<ProductFormState> {
  const { tenant } = await requireTenant();

  // A product is only sellable once buyers have somewhere to pay; mirror the
  // payment-page rule and require a connected gateway before listing a catalog.
  const gw = await getSellerGateway(tenant.id);
  if (!gw) {
    return { error: "Connect your payment gateway first (Connect gateway)." };
  }

  const slug = String(form.get("slug") ?? "").trim().toLowerCase();
  if (!SLUG_RE.test(slug)) {
    return { error: "Link must be 1–50 chars: lowercase letters, digits, hyphens." };
  }

  const parsed = parseProductFields(form);
  if (!parsed.ok) return { error: parsed.message };

  const publish = form.get("publish") === "on";
  const result = await createProduct({
    tenantId: tenant.id,
    slug,
    ...parsed.value,
    status: publish ? "PUBLISHED" : "DRAFT",
  });
  if (!result.ok) return { error: `The link "/p/${slug}" is already in use.` };

  revalidatePath("/products");
  redirect("/products");
}

export async function updateProductAction(
  id: string,
  _prev: ProductFormState,
  form: FormData,
): Promise<ProductFormState> {
  const { tenant } = await requireTenant();
  const parsed = parseProductFields(form);
  if (!parsed.ok) return { error: parsed.message };

  await updateProduct(tenant.id, id, parsed.value);
  revalidatePath("/products");
  redirect("/products");
}

export async function setProductStatusAction(id: string, status: ProductStatus) {
  const { tenant } = await requireTenant();
  await setProductStatus(tenant.id, id, status);
  const verb =
    status === "PUBLISHED" ? "published" : status === "ARCHIVED" ? "archived" : "unpublished";
  await logActivity(tenant.id, `product.${verb}`).catch(() => {});
  revalidatePath("/products");
}
