"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createPaymentPage,
  updatePaymentPage,
  setPaymentPageActive,
  getSellerGateway,
  getEnabledSellerUpi,
  type ProductKind,
} from "@invoxai/db";
import { rupeeStringToPaise } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";

export type PageFormState = { error?: string };

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;
const KINDS: ProductKind[] = ["DIGITAL", "PHYSICAL", "SERVICE"];

interface ParsedPage {
  title: string;
  description: string | null;
  amountPaise: number;
  compareAtPaise: number | null;
  imageUrl: string | null;
  accessUrl: string | null;
  kind: ProductKind;
}

function parsePageFields(
  form: FormData,
): { ok: true; value: ParsedPage } | { ok: false; message: string } {
  const title = String(form.get("title") ?? "").trim();
  if (!title) return { ok: false, message: "Title is required." };
  const amount = rupeeStringToPaise(String(form.get("amount") ?? ""));
  if (!amount.ok) return { ok: false, message: `Amount: ${amount.message}` };
  if (amount.paise <= 0) return { ok: false, message: "Amount must be greater than ₹0." };

  // Optional compare-at (must be above the amount, else there's no deal to show).
  const compareRaw = String(form.get("compareAt") ?? "").trim();
  let compareAtPaise: number | null = null;
  if (compareRaw) {
    const cmp = rupeeStringToPaise(compareRaw);
    if (!cmp.ok) return { ok: false, message: `Compare-at price: ${cmp.message}` };
    if (cmp.paise <= amount.paise) {
      return { ok: false, message: "Compare-at price must be higher than the amount." };
    }
    compareAtPaise = cmp.paise;
  }

  const imageRaw = String(form.get("imageUrl") ?? "").trim();
  if (imageRaw && !/^https?:\/\/\S+$/.test(imageRaw)) {
    return { ok: false, message: "Image URL must start with http:// or https://" };
  }
  const accessRaw = String(form.get("accessUrl") ?? "").trim();
  if (accessRaw && !/^https?:\/\/\S+$/.test(accessRaw)) {
    return { ok: false, message: "Access link must start with http:// or https://" };
  }

  const kindRaw = String(form.get("kind") ?? "DIGITAL");
  const kind = KINDS.includes(kindRaw as ProductKind) ? (kindRaw as ProductKind) : "DIGITAL";

  const description = String(form.get("description") ?? "").trim() || null;
  return {
    ok: true,
    value: {
      title,
      description,
      amountPaise: amount.paise,
      compareAtPaise,
      imageUrl: imageRaw || null,
      accessUrl: accessRaw || null,
      kind,
    },
  };
}

export async function createPaymentPageAction(
  _prev: PageFormState,
  form: FormData,
): Promise<PageFormState> {
  const { tenant } = await requireTenant();

  // A payment page is useless without a place for the money to land — Razorpay
  // or a manual UPI ID.
  const [gw, upi] = await Promise.all([
    getSellerGateway(tenant.id),
    getEnabledSellerUpi(tenant.id),
  ]);
  if (!gw && !upi) {
    return { error: "Set up payments first — connect Razorpay or add a UPI ID (Payments)." };
  }

  const slug = String(form.get("slug") ?? "").trim().toLowerCase();
  if (!SLUG_RE.test(slug)) {
    return { error: "Link must be 1–50 chars: lowercase letters, digits, hyphens." };
  }

  const fields = parsePageFields(form);
  if (!fields.ok) return { error: fields.message };

  const result = await createPaymentPage({
    tenantId: tenant.id,
    slug,
    ...fields.value,
  });
  if (!result.ok) return { error: `The link "/pay/${slug}" is already in use.` };

  revalidatePath("/pay-pages");
  redirect("/pay-pages");
}

export async function updatePaymentPageAction(
  id: string,
  _prev: PageFormState,
  form: FormData,
): Promise<PageFormState> {
  const { tenant } = await requireTenant();
  const fields = parsePageFields(form);
  if (!fields.ok) return { error: fields.message };

  await updatePaymentPage(tenant.id, id, fields.value);
  revalidatePath("/pay-pages");
  redirect("/pay-pages");
}

export async function setPaymentPageActiveAction(id: string, isActive: boolean) {
  const { tenant } = await requireTenant();
  await setPaymentPageActive(tenant.id, id, isActive);
  revalidatePath("/pay-pages");
}
