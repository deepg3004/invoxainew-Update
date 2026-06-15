"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createBookingType,
  updateBookingType,
  setBookingTypeStatus,
  getBookingTypeById,
  addBookingSlots,
  deleteBookingSlot,
  getSellerGateway,
  type BookingTypeStatus,
} from "@invoxai/db";
import { rupeeStringToPaise } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";

export type BookingFormState = { error?: string; saved?: boolean };

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;
const HTTP_RE = /^https?:\/\/\S+$/;

interface ParsedBookingType {
  title: string;
  description: string | null;
  pricePaise: number;
  compareAtPaise: number | null;
  imageUrl: string | null;
  meetingUrl: string | null;
  durationMins: number | null;
  sortOrder: number;
}

function parseFields(
  form: FormData,
): { ok: true; value: ParsedBookingType } | { ok: false; message: string } {
  const title = String(form.get("title") ?? "").trim();
  if (!title) return { ok: false, message: "Title is required." };

  const priceRaw = String(form.get("price") ?? "").trim();
  let pricePaise = 0;
  if (priceRaw && priceRaw !== "0") {
    const price = rupeeStringToPaise(priceRaw);
    if (!price.ok) return { ok: false, message: `Price: ${price.message}` };
    pricePaise = price.paise;
  }
  if (pricePaise <= 0) return { ok: false, message: "A 1-on-1 needs a price greater than ₹0." };

  let compareAtPaise: number | null = null;
  const compareRaw = String(form.get("compareAt") ?? "").trim();
  if (compareRaw) {
    const cmp = rupeeStringToPaise(compareRaw);
    if (!cmp.ok) return { ok: false, message: `Compare-at price: ${cmp.message}` };
    if (cmp.paise <= pricePaise) return { ok: false, message: "Compare-at price must be higher than the price." };
    compareAtPaise = cmp.paise;
  }

  const imageRaw = String(form.get("imageUrl") ?? "").trim();
  if (imageRaw && !HTTP_RE.test(imageRaw)) {
    return { ok: false, message: "Image URL must start with http:// or https://" };
  }
  const meetingRaw = String(form.get("meetingUrl") ?? "").trim();
  if (meetingRaw && !HTTP_RE.test(meetingRaw)) {
    return { ok: false, message: "Meeting link must start with http:// or https:// (e.g. a Zoom/Meet link)." };
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
      meetingUrl: meetingRaw || null,
      durationMins,
      sortOrder,
    },
  };
}

export async function createBookingTypeAction(
  _prev: BookingFormState,
  form: FormData,
): Promise<BookingFormState> {
  const { tenant } = await requireTenant();

  const slug = String(form.get("slug") ?? "").trim().toLowerCase();
  if (!SLUG_RE.test(slug)) {
    return { error: "Link must be 1–50 chars: lowercase letters, digits, hyphens." };
  }
  const parsed = parseFields(form);
  if (!parsed.ok) return { error: parsed.message };

  // Paid → require a connected gateway so buyers can pay.
  const gw = await getSellerGateway(tenant.id);
  if (!gw) return { error: "Connect your payment gateway first to sell a 1-on-1." };

  const publish = form.get("publish") === "on";
  const result = await createBookingType({
    tenantId: tenant.id,
    slug,
    ...parsed.value,
    status: publish ? "PUBLISHED" : "DRAFT",
  });
  if (!result.ok) return { error: `The link "/b/${slug}" is already in use.` };

  revalidatePath("/bookings");
  redirect(`/bookings/${result.id}`);
}

export async function updateBookingTypeAction(
  id: string,
  _prev: BookingFormState,
  form: FormData,
): Promise<BookingFormState> {
  const { tenant } = await requireTenant();
  const parsed = parseFields(form);
  if (!parsed.ok) return { error: parsed.message };

  await updateBookingType(tenant.id, id, parsed.value);
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${id}`);
  return { saved: true };
}

export async function setBookingTypeStatusAction(id: string, status: BookingTypeStatus) {
  const { tenant } = await requireTenant();
  await setBookingTypeStatus(tenant.id, id, status);
  revalidatePath("/bookings");
}

export type SlotActionResult = { ok: true; added: number } | { ok: false; error: string };

/** Add time slots (ISO datetime strings) to a type the seller owns. */
export async function addSlotsAction(bookingTypeId: string, isoTimes: string[]): Promise<SlotActionResult> {
  const { tenant } = await requireTenant();
  const type = await getBookingTypeById(tenant.id, bookingTypeId);
  if (!type) return { ok: false, error: "Not found." };
  const dates = (Array.isArray(isoTimes) ? isoTimes : [])
    .map((s) => new Date(String(s)))
    .filter((d) => !Number.isNaN(d.getTime()));
  if (dates.length === 0) return { ok: false, error: "Add at least one valid future time." };
  const added = await addBookingSlots(tenant.id, bookingTypeId, dates);
  revalidatePath(`/bookings/${bookingTypeId}`);
  return added > 0 ? { ok: true, added } : { ok: false, error: "Those times are in the past." };
}

export async function deleteSlotAction(bookingTypeId: string, slotId: string): Promise<void> {
  const { tenant } = await requireTenant();
  await deleteBookingSlot(tenant.id, slotId);
  revalidatePath(`/bookings/${bookingTypeId}`);
}
