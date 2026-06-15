import { Prisma, type BookingTypeStatus } from "@prisma/client";
import { prisma } from "./client";

/**
 * 1-on-1 bookings / consultations. Same money rail as workshops: a BookingType is
 * sold on the SELLER's gateway and a PAID order claims a SLOT + grants a Booking
 * (claim-winner only, in markBuyerPaymentPaid — see payments.ts). This file is the
 * catalog + slots + booking reads. Every read/write is tenant-scoped. The slot
 * claim itself is atomic in the money path; here a checkout-time OPEN check makes a
 * double-pay rare (and the money path records a slot-less booking if it ever loses,
 * so a payment is never lost).
 */

// ── BookingType (seller-managed) ──────────────────────────────────────────────

export type CreateBookingTypeResult =
  | { ok: true; id: string }
  | { ok: false; reason: "slug_taken" };

export async function createBookingType(input: {
  tenantId: string;
  slug: string;
  title: string;
  description?: string | null;
  pricePaise: number;
  compareAtPaise?: number | null;
  imageUrl?: string | null;
  meetingUrl?: string | null;
  durationMins?: number | null;
  sortOrder?: number;
  status?: BookingTypeStatus;
}): Promise<CreateBookingTypeResult> {
  try {
    const t = await prisma.bookingType.create({
      data: {
        tenantId: input.tenantId,
        slug: input.slug,
        title: input.title,
        description: input.description ?? null,
        pricePaise: input.pricePaise,
        compareAtPaise: input.compareAtPaise ?? null,
        imageUrl: input.imageUrl ?? null,
        meetingUrl: input.meetingUrl ?? null,
        durationMins: input.durationMins ?? null,
        sortOrder: input.sortOrder ?? 0,
        status: input.status ?? "DRAFT",
      },
      select: { id: true },
    });
    return { ok: true, id: t.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, reason: "slug_taken" };
    }
    throw e;
  }
}

export function listBookingTypes(tenantId: string, opts: { skip?: number; take?: number } = {}) {
  return prisma.bookingType.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { slots: true, bookings: true } } },
    skip: opts.skip,
    take: opts.take,
  });
}

export function countBookingTypes(tenantId: string) {
  return prisma.bookingType.count({ where: { tenantId } });
}

export function getBookingTypeById(tenantId: string, id: string) {
  return prisma.bookingType.findFirst({ where: { id, tenantId } });
}

export function updateBookingType(
  tenantId: string,
  id: string,
  data: {
    title: string;
    description?: string | null;
    pricePaise: number;
    compareAtPaise?: number | null;
    imageUrl?: string | null;
    meetingUrl?: string | null;
    durationMins?: number | null;
    sortOrder?: number;
  },
) {
  return prisma.bookingType.updateMany({
    where: { id, tenantId },
    data: {
      title: data.title,
      description: data.description ?? null,
      pricePaise: data.pricePaise,
      compareAtPaise: data.compareAtPaise ?? null,
      imageUrl: data.imageUrl ?? null,
      meetingUrl: data.meetingUrl ?? null,
      durationMins: data.durationMins ?? null,
      sortOrder: data.sortOrder ?? 0,
    },
  });
}

export function setBookingTypeStatus(tenantId: string, id: string, status: BookingTypeStatus) {
  return prisma.bookingType.updateMany({ where: { id, tenantId }, data: { status } });
}

// ── Slots (seller-managed; ownership via the parent type) ─────────────────────

/** Add OPEN slots to a type the seller owns. Caller verifies ownership. Skips past
 *  datetimes. Returns how many were added. */
export async function addBookingSlots(
  tenantId: string,
  bookingTypeId: string,
  startsAt: Date[],
): Promise<number> {
  const now = Date.now();
  const valid = startsAt.filter((d) => d instanceof Date && !Number.isNaN(d.getTime()) && d.getTime() > now);
  if (valid.length === 0) return 0;
  const res = await prisma.bookingSlot.createMany({
    data: valid.map((d) => ({ tenantId, bookingTypeId, startsAt: d })),
  });
  return res.count;
}

/** All slots of a type (seller view), soonest first. */
export function listSlots(bookingTypeId: string) {
  return prisma.bookingSlot.findMany({
    where: { bookingTypeId },
    orderBy: { startsAt: "asc" },
  });
}

/** Delete a slot the seller owns — only if still OPEN (can't drop a booked slot). */
export async function deleteBookingSlot(tenantId: string, slotId: string): Promise<boolean> {
  const res = await prisma.bookingSlot.deleteMany({
    where: { id: slotId, tenantId, status: "OPEN" },
  });
  return res.count === 1;
}

// ── Public storefront reads ───────────────────────────────────────────────────

export function listPublishedBookingTypes(tenantId: string) {
  return prisma.bookingType.findMany({
    where: { tenantId, status: "PUBLISHED" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
}

/** A PUBLISHED type by slug, with its upcoming OPEN slots (for the booking page). */
export function getPublishedBookingType(tenantId: string, slug: string) {
  return prisma.bookingType.findFirst({
    where: { tenantId, slug, status: "PUBLISHED" },
    include: {
      slots: {
        where: { status: "OPEN", startsAt: { gt: new Date() } },
        orderBy: { startsAt: "asc" },
        take: 100,
      },
    },
  });
}

/** A PUBLISHED type by id — checkout reads price/title server-trusted. */
export function getPublishedBookingTypeById(id: string) {
  return prisma.bookingType.findFirst({ where: { id, status: "PUBLISHED" } });
}

/** A PUBLISHED type's meta — the account area reveals meetingUrl after the booking
 *  check. */
export function getPublishedBookingTypeMeta(tenantId: string, slug: string) {
  return prisma.bookingType.findFirst({ where: { tenantId, slug, status: "PUBLISHED" } });
}

/** A slot that is OPEN + in the future + belongs to this type — for the checkout
 *  pre-check (the authoritative claim is atomic at PAID). Returns null otherwise. */
export function getOpenSlot(bookingTypeId: string, slotId: string) {
  return prisma.bookingSlot.findFirst({
    where: { id: slotId, bookingTypeId, status: "OPEN", startsAt: { gt: new Date() } },
  });
}

// ── Bookings (access grants; paid writes live in payments.ts) ─────────────────

/** This buyer's bookings of a type, or empty. Attributed by profileId OR email. */
export function getBuyerBookingForType(input: {
  tenantId: string;
  bookingTypeId: string;
  profileId: string;
  email?: string | null;
}) {
  const attribution: Prisma.BookingWhereInput[] = [{ buyerProfileId: input.profileId }];
  if (input.email) attribution.push({ buyerEmail: input.email });
  return prisma.booking.findFirst({
    where: { tenantId: input.tenantId, bookingTypeId: input.bookingTypeId, OR: attribution },
    orderBy: { createdAt: "desc" },
  });
}

/** A buyer's bookings on this tenant (account page), newest first. */
export async function listBuyerBookings(input: {
  tenantId: string;
  profileId: string;
  email?: string | null;
}) {
  const attribution: Prisma.BookingWhereInput[] = [{ buyerProfileId: input.profileId }];
  if (input.email) attribution.push({ buyerEmail: input.email });
  return prisma.booking.findMany({
    where: { tenantId: input.tenantId, OR: attribution },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { bookingType: { select: { slug: true, title: true, imageUrl: true } } },
  });
}

/** All bookings for a type (seller view), with slot time + buyer. */
export function listBookingsForType(tenantId: string, bookingTypeId: string) {
  return prisma.booking.findMany({
    where: { tenantId, bookingTypeId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}
