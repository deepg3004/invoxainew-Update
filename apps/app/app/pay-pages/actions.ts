"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createPaymentPage,
  updatePaymentPage,
  setPaymentPageActive,
  getSellerGateway,
} from "@invoxai/db";
import { rupeeStringToPaise } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";

export type PageFormState = { error?: string };

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;

function parsePageFields(form: FormData):
  | { ok: true; title: string; description: string | null; amountPaise: number }
  | { ok: false; message: string } {
  const title = String(form.get("title") ?? "").trim();
  if (!title) return { ok: false, message: "Title is required." };
  const amount = rupeeStringToPaise(String(form.get("amount") ?? ""));
  if (!amount.ok) return { ok: false, message: `Amount: ${amount.message}` };
  if (amount.paise <= 0) return { ok: false, message: "Amount must be greater than ₹0." };
  const description = String(form.get("description") ?? "").trim() || null;
  return { ok: true, title, description, amountPaise: amount.paise };
}

export async function createPaymentPageAction(
  _prev: PageFormState,
  form: FormData,
): Promise<PageFormState> {
  const { tenant } = await requireTenant();

  // A payment page is useless without a place for the money to land.
  const gw = await getSellerGateway(tenant.id);
  if (!gw) {
    return { error: "Connect your payment gateway first (Payments → Connect)." };
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
    title: fields.title,
    description: fields.description,
    amountPaise: fields.amountPaise,
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

  await updatePaymentPage(tenant.id, id, {
    title: fields.title,
    description: fields.description,
    amountPaise: fields.amountPaise,
  });
  revalidatePath("/pay-pages");
  redirect("/pay-pages");
}

export async function setPaymentPageActiveAction(id: string, isActive: boolean) {
  const { tenant } = await requireTenant();
  await setPaymentPageActive(tenant.id, id, isActive);
  revalidatePath("/pay-pages");
}
