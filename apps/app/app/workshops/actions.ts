"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createWorkshop,
  updateWorkshop,
  setWorkshopStatus,
  getSellerGateway,
  type WorkshopStatus,
} from "@invoxai/db";
import { rupeeStringToPaise } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";

export type WorkshopFormState = { error?: string; saved?: boolean };

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;
const HTTP_RE = /^https?:\/\/\S+$/;

interface ParsedWorkshop {
  title: string;
  description: string | null;
  pricePaise: number;
  compareAtPaise: number | null;
  imageUrl: string | null;
  joinUrl: string | null;
  scheduledAt: Date | null;
  durationMins: number | null;
  maxSeats: number | null;
  sortOrder: number;
}

function parseWorkshopFields(
  form: FormData,
): { ok: true; value: ParsedWorkshop } | { ok: false; message: string } {
  const title = String(form.get("title") ?? "").trim();
  if (!title) return { ok: false, message: "Title is required." };

  // Price: blank or 0 = free. Anything else must be a valid amount.
  const priceRaw = String(form.get("price") ?? "").trim();
  let pricePaise = 0;
  if (priceRaw && priceRaw !== "0") {
    const price = rupeeStringToPaise(priceRaw);
    if (!price.ok) return { ok: false, message: `Price: ${price.message}` };
    pricePaise = price.paise;
  }

  let compareAtPaise: number | null = null;
  const compareRaw = String(form.get("compareAt") ?? "").trim();
  if (compareRaw && pricePaise > 0) {
    const cmp = rupeeStringToPaise(compareRaw);
    if (!cmp.ok) return { ok: false, message: `Compare-at price: ${cmp.message}` };
    if (cmp.paise <= pricePaise) {
      return { ok: false, message: "Compare-at price must be higher than the price." };
    }
    compareAtPaise = cmp.paise;
  }

  const imageRaw = String(form.get("imageUrl") ?? "").trim();
  if (imageRaw && !HTTP_RE.test(imageRaw)) {
    return { ok: false, message: "Image URL must start with http:// or https://" };
  }
  const joinRaw = String(form.get("joinUrl") ?? "").trim();
  if (joinRaw && !HTTP_RE.test(joinRaw)) {
    return { ok: false, message: "Join link must start with http:// or https:// (e.g. a Zoom/Meet link)." };
  }

  let scheduledAt: Date | null = null;
  const whenRaw = String(form.get("scheduledAt") ?? "").trim();
  if (whenRaw) {
    const d = new Date(whenRaw);
    if (Number.isNaN(d.getTime())) return { ok: false, message: "Date & time is invalid." };
    scheduledAt = d;
  }

  let durationMins: number | null = null;
  const durRaw = String(form.get("durationMins") ?? "").trim();
  if (durRaw) {
    const n = Number(durRaw);
    if (!Number.isInteger(n) || n <= 0 || n > 1440) {
      return { ok: false, message: "Duration must be a whole number of minutes (1–1440)." };
    }
    durationMins = n;
  }

  let maxSeats: number | null = null;
  const seatsRaw = String(form.get("maxSeats") ?? "").trim();
  if (seatsRaw) {
    const n = Number(seatsRaw);
    if (!Number.isInteger(n) || n <= 0 || n > 100000) {
      return { ok: false, message: "Max seats must be a whole number (1–100000), or blank for unlimited." };
    }
    maxSeats = n;
  }

  const orderRaw = String(form.get("sortOrder") ?? "").trim();
  let sortOrder = 0;
  if (orderRaw) {
    const n = Number(orderRaw);
    if (!Number.isInteger(n)) return { ok: false, message: "Display order must be a whole number." };
    sortOrder = n;
  }

  return {
    ok: true,
    value: {
      title,
      description: String(form.get("description") ?? "").trim() || null,
      pricePaise,
      compareAtPaise,
      imageUrl: imageRaw || null,
      joinUrl: joinRaw || null,
      scheduledAt,
      durationMins,
      maxSeats,
      sortOrder,
    },
  };
}

export async function createWorkshopAction(
  _prev: WorkshopFormState,
  form: FormData,
): Promise<WorkshopFormState> {
  const { tenant } = await requireTenant();

  const slug = String(form.get("slug") ?? "").trim().toLowerCase();
  if (!SLUG_RE.test(slug)) {
    return { error: "Link must be 1–50 chars: lowercase letters, digits, hyphens." };
  }

  const parsed = parseWorkshopFields(form);
  if (!parsed.ok) return { error: parsed.message };

  // A PAID workshop needs a connected gateway so buyers can pay. A FREE one doesn't.
  if (parsed.value.pricePaise > 0) {
    const gw = await getSellerGateway(tenant.id);
    if (!gw) return { error: "Connect your payment gateway first to sell a paid workshop." };
  }

  const publish = form.get("publish") === "on";
  const result = await createWorkshop({
    tenantId: tenant.id,
    slug,
    ...parsed.value,
    status: publish ? "PUBLISHED" : "DRAFT",
  });
  if (!result.ok) return { error: `The link "/w/${slug}" is already in use.` };

  revalidatePath("/workshops");
  redirect(`/workshops/${result.id}`);
}

export async function updateWorkshopAction(
  id: string,
  _prev: WorkshopFormState,
  form: FormData,
): Promise<WorkshopFormState> {
  const { tenant } = await requireTenant();
  const parsed = parseWorkshopFields(form);
  if (!parsed.ok) return { error: parsed.message };

  await updateWorkshop(tenant.id, id, parsed.value);
  revalidatePath("/workshops");
  revalidatePath(`/workshops/${id}`);
  return { saved: true };
}

export async function setWorkshopStatusAction(id: string, status: WorkshopStatus) {
  const { tenant } = await requireTenant();
  await setWorkshopStatus(tenant.id, id, status);
  revalidatePath("/workshops");
}
