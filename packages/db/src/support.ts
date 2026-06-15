import { prisma } from "./client";
import type { SupportTicketStatus } from "@prisma/client";

/**
 * Ops — buyer support tickets. A buyer opens a thread from the Buyer Corner; the
 * seller answers from their dashboard. Isolation: seller reads/writes are scoped by
 * tenantId; buyer reads/writes additionally pass `canBuyerAccess` so one buyer can
 * never read another's thread (a forged ticket id matches nothing). No money path.
 */

export interface BuyerIdentity {
  profileId?: string | null;
  email?: string | null;
}

/**
 * Whether a buyer may access a ticket: same tenant AND attributed to them — by
 * logged-in profile id, or by the email they opened it with (case-insensitive). PURE
 * — this is the buyer-side isolation boundary, so it's unit-tested.
 */
export function canBuyerAccess(
  ticket: { tenantId: string; buyerProfileId: string | null; buyerEmail: string },
  tenantId: string,
  buyer: BuyerIdentity,
): boolean {
  if (ticket.tenantId !== tenantId) return false;
  if (buyer.profileId && ticket.buyerProfileId === buyer.profileId) return true;
  const email = buyer.email?.trim().toLowerCase();
  if (email && ticket.buyerEmail.toLowerCase() === email) return true;
  return false;
}

// ── Buyer side ───────────────────────────────────────────────────────────────

/** Open a new ticket with its first (buyer) message. Returns the ticket id. */
export async function createSupportTicket(input: {
  tenantId: string;
  buyerProfileId?: string | null;
  buyerEmail: string;
  subject: string;
  body: string;
}): Promise<string> {
  const ticket = await prisma.supportTicket.create({
    data: {
      tenantId: input.tenantId,
      buyerProfileId: input.buyerProfileId ?? null,
      buyerEmail: input.buyerEmail.trim().toLowerCase(),
      subject: input.subject,
      status: "OPEN",
      messages: { create: { sender: "BUYER", body: input.body } },
    },
    select: { id: true },
  });
  return ticket.id;
}

/** A buyer's own tickets on this tenant, newest activity first. */
export function listBuyerTickets(tenantId: string, buyer: BuyerIdentity) {
  const ors = buyerOrFilter(buyer);
  if (ors.length === 0) return Promise.resolve([]);
  return prisma.supportTicket.findMany({
    where: { tenantId, OR: ors },
    orderBy: { updatedAt: "desc" },
    select: { id: true, subject: true, status: true, updatedAt: true },
  });
}

/** One ticket with its thread, only if it belongs to this buyer. */
export async function getBuyerTicket(tenantId: string, ticketId: string, buyer: BuyerIdentity) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!ticket || !canBuyerAccess(ticket, tenantId, buyer)) return null;
  return ticket;
}

/** Append a buyer reply (re-opens the ticket for the seller). Ownership-checked. */
export async function addBuyerReply(
  tenantId: string,
  ticketId: string,
  buyer: BuyerIdentity,
  body: string,
): Promise<boolean> {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, tenantId: true, buyerProfileId: true, buyerEmail: true, status: true },
  });
  if (!ticket || !canBuyerAccess(ticket, tenantId, buyer)) return false;
  await prisma.$transaction([
    prisma.supportMessage.create({ data: { ticketId, sender: "BUYER", body } }),
    prisma.supportTicket.update({
      where: { id: ticketId },
      // A closed ticket stays closed on a buyer note; otherwise it awaits the seller.
      data: { status: ticket.status === "CLOSED" ? "CLOSED" : "OPEN" },
    }),
  ]);
  return true;
}

function buyerOrFilter(buyer: BuyerIdentity) {
  const ors: { buyerProfileId?: string; buyerEmail?: string }[] = [];
  if (buyer.profileId) ors.push({ buyerProfileId: buyer.profileId });
  const email = buyer.email?.trim().toLowerCase();
  if (email) ors.push({ buyerEmail: email });
  return ors;
}

// ── Seller side ──────────────────────────────────────────────────────────────

/** The seller's ticket inbox (tenant-scoped), newest activity first. */
export function listSellerTickets(tenantId: string, opts: { skip?: number; take?: number } = {}) {
  return prisma.supportTicket.findMany({
    where: { tenantId },
    orderBy: { updatedAt: "desc" },
    skip: opts.skip,
    take: opts.take ?? 100,
    select: {
      id: true,
      subject: true,
      buyerEmail: true,
      status: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });
}

export function countOpenTickets(tenantId: string) {
  return prisma.supportTicket.count({ where: { tenantId, status: "OPEN" } });
}

/** One ticket + thread, scoped to the owning seller. */
export function getSellerTicket(tenantId: string, ticketId: string) {
  return prisma.supportTicket.findFirst({
    where: { id: ticketId, tenantId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
}

/** Append a seller reply (marks the ticket ANSWERED). Tenant-scoped. */
export async function addSellerReply(
  tenantId: string,
  ticketId: string,
  body: string,
): Promise<boolean> {
  const owned = await prisma.supportTicket.findFirst({
    where: { id: ticketId, tenantId },
    select: { id: true },
  });
  if (!owned) return false;
  await prisma.$transaction([
    prisma.supportMessage.create({ data: { ticketId, sender: "SELLER", body } }),
    prisma.supportTicket.update({ where: { id: ticketId }, data: { status: "ANSWERED" } }),
  ]);
  return true;
}

export function setTicketStatus(tenantId: string, ticketId: string, status: SupportTicketStatus) {
  return prisma.supportTicket.updateMany({ where: { id: ticketId, tenantId }, data: { status } });
}
