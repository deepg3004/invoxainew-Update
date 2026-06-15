import { Prisma, type WorkshopStatus } from "@prisma/client";
import { prisma } from "./client";

/**
 * Live workshops (sessions). Same money model as communities/courses: a workshop is
 * sold on the SELLER's gateway and the PAID order grants a WorkshopRegistration
 * (claim-winner only, in markBuyerPaymentPaid — see payments.ts). This file is the
 * catalog + registration reads + the seat helpers. Every read/write is tenant-scoped.
 *
 * Seats: `maxSeats` is a SOFT cap. `seatsRemaining` is computed from paid
 * registrations and checked best-effort at checkout (startWorkshopCheckout); a rare
 * race can let one extra in, which is acceptable for a live session (the host can
 * accommodate or refund) and never corrupts the money path.
 */

// ── Pure seat logic (unit-tested) ─────────────────────────────────────────────

/** Seats left given an optional cap and how many are taken. null cap = unlimited. */
export function seatsRemaining(maxSeats: number | null | undefined, taken: number): number | null {
  if (maxSeats == null) return null; // unlimited
  return Math.max(0, maxSeats - taken);
}

/** Is the workshop sold out? Unlimited (null cap) is never sold out. */
export function isSoldOut(maxSeats: number | null | undefined, taken: number): boolean {
  const left = seatsRemaining(maxSeats, taken);
  return left !== null && left <= 0;
}

// ── Workshops (seller-managed) ────────────────────────────────────────────────

export type CreateWorkshopResult =
  | { ok: true; id: string }
  | { ok: false; reason: "slug_taken" };

export async function createWorkshop(input: {
  tenantId: string;
  slug: string;
  title: string;
  description?: string | null;
  pricePaise: number;
  compareAtPaise?: number | null;
  imageUrl?: string | null;
  joinUrl?: string | null;
  scheduledAt?: Date | null;
  durationMins?: number | null;
  maxSeats?: number | null;
  sortOrder?: number;
  status?: WorkshopStatus;
}): Promise<CreateWorkshopResult> {
  try {
    const w = await prisma.workshop.create({
      data: {
        tenantId: input.tenantId,
        slug: input.slug,
        title: input.title,
        description: input.description ?? null,
        pricePaise: input.pricePaise,
        compareAtPaise: input.compareAtPaise ?? null,
        imageUrl: input.imageUrl ?? null,
        joinUrl: input.joinUrl ?? null,
        scheduledAt: input.scheduledAt ?? null,
        durationMins: input.durationMins ?? null,
        maxSeats: input.maxSeats ?? null,
        sortOrder: input.sortOrder ?? 0,
        status: input.status ?? "DRAFT",
      },
      select: { id: true },
    });
    return { ok: true, id: w.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, reason: "slug_taken" };
    }
    throw e;
  }
}

/** A seller's workshops, with registration counts. Scoped by tenantId. */
export function listWorkshops(tenantId: string, opts: { skip?: number; take?: number } = {}) {
  return prisma.workshop.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { registrations: true } } },
    skip: opts.skip,
    take: opts.take,
  });
}

export function countWorkshops(tenantId: string) {
  return prisma.workshop.count({ where: { tenantId } });
}

export function getWorkshopById(tenantId: string, id: string) {
  return prisma.workshop.findFirst({ where: { id, tenantId } });
}

export function updateWorkshop(
  tenantId: string,
  id: string,
  data: {
    title: string;
    description?: string | null;
    pricePaise: number;
    compareAtPaise?: number | null;
    imageUrl?: string | null;
    joinUrl?: string | null;
    scheduledAt?: Date | null;
    durationMins?: number | null;
    maxSeats?: number | null;
    sortOrder?: number;
  },
) {
  return prisma.workshop.updateMany({
    where: { id, tenantId },
    data: {
      title: data.title,
      description: data.description ?? null,
      pricePaise: data.pricePaise,
      compareAtPaise: data.compareAtPaise ?? null,
      imageUrl: data.imageUrl ?? null,
      joinUrl: data.joinUrl ?? null,
      scheduledAt: data.scheduledAt ?? null,
      durationMins: data.durationMins ?? null,
      maxSeats: data.maxSeats ?? null,
      sortOrder: data.sortOrder ?? 0,
    },
  });
}

export function setWorkshopStatus(tenantId: string, id: string, status: WorkshopStatus) {
  return prisma.workshop.updateMany({ where: { id, tenantId }, data: { status } });
}

// ── Public storefront reads ───────────────────────────────────────────────────

export function listPublishedWorkshops(tenantId: string) {
  return prisma.workshop.findMany({
    where: { tenantId, status: "PUBLISHED" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { registrations: true } } },
  });
}

/** A PUBLISHED workshop by tenant+slug for the public sales page (joinUrl is
 *  members-only, so callers should not surface it on the public page). */
export function getPublishedWorkshop(tenantId: string, slug: string) {
  return prisma.workshop.findFirst({
    where: { tenantId, slug, status: "PUBLISHED" },
    include: { _count: { select: { registrations: true } } },
  });
}

/** A PUBLISHED workshop by id — used by the buyer checkout action so price/title/
 *  seat cap are read server-trusted from the DB. */
export function getPublishedWorkshopById(id: string) {
  return prisma.workshop.findFirst({ where: { id, status: "PUBLISHED" } });
}

/** A PUBLISHED workshop's meta — for the account area, which reveals joinUrl only
 *  after the registration check. */
export function getPublishedWorkshopMeta(tenantId: string, slug: string) {
  return prisma.workshop.findFirst({ where: { tenantId, slug, status: "PUBLISHED" } });
}

/** Count of PAID registrations for a workshop (for the seat soft-cap + seller list). */
export function countWorkshopRegistrations(workshopId: string) {
  return prisma.workshopRegistration.count({ where: { workshopId } });
}

// ── Registrations (access grants; paid writes live in payments.ts) ────────────

/** This buyer's registration in a workshop, or null. Attributed by profileId
 *  (logged in) OR matching purchase email (guest). Tenant-scoped. */
export function getWorkshopRegistration(input: {
  tenantId: string;
  workshopId: string;
  profileId: string;
  email?: string | null;
}) {
  const attribution: Prisma.WorkshopRegistrationWhereInput[] = [
    { buyerProfileId: input.profileId },
  ];
  if (input.email) attribution.push({ buyerEmail: input.email });
  return prisma.workshopRegistration.findFirst({
    where: { tenantId: input.tenantId, workshopId: input.workshopId, OR: attribution },
  });
}

/** The workshops this buyer has registered for on this tenant (deduped, non-archived). */
export async function listRegisteredWorkshops(input: {
  tenantId: string;
  profileId: string;
  email?: string | null;
}) {
  const attribution: Prisma.WorkshopRegistrationWhereInput[] = [
    { buyerProfileId: input.profileId },
  ];
  if (input.email) attribution.push({ buyerEmail: input.email });
  const regs = await prisma.workshopRegistration.findMany({
    where: { tenantId: input.tenantId, OR: attribution },
    orderBy: { createdAt: "desc" },
    distinct: ["workshopId"],
    include: {
      workshop: {
        select: { id: true, slug: true, title: true, imageUrl: true, scheduledAt: true, status: true },
      },
    },
  });
  return regs.map((r) => r.workshop).filter((w) => w.status !== "ARCHIVED");
}

export type JoinFreeWorkshopResult =
  | { ok: true }
  | { ok: false; reason: "not_free" | "not_found" };

/**
 * Register for a FREE workshop directly (no payment). Idempotent — createMany with
 * skipDuplicates can't double-insert on a race. NOT a money path (price must be 0);
 * the workshop is re-read server-trusted so a paid one can't be joined for free.
 */
export async function joinFreeWorkshop(input: {
  tenantId: string;
  workshopId: string;
  profileId: string;
  email?: string | null;
}): Promise<JoinFreeWorkshopResult> {
  const workshop = await prisma.workshop.findFirst({
    where: { id: input.workshopId, tenantId: input.tenantId, status: "PUBLISHED" },
    select: { pricePaise: true },
  });
  if (!workshop) return { ok: false, reason: "not_found" };
  if (workshop.pricePaise > 0) return { ok: false, reason: "not_free" };

  await prisma.workshopRegistration.createMany({
    data: [
      {
        tenantId: input.tenantId,
        workshopId: input.workshopId,
        buyerProfileId: input.profileId,
        buyerEmail: input.email ?? null,
        source: "free",
      },
    ],
    skipDuplicates: true,
  });
  return { ok: true };
}
