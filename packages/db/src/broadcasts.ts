import { prisma } from "./client";
import { listContacts } from "./crm";

/**
 * Phase 14 — email Broadcasts. A broadcast is composed as a DRAFT, then "sent":
 * we SNAPSHOT the current segment of contacts into BroadcastRecipient rows and
 * move the broadcast to QUEUED. A scheduled worker (sweepBroadcasts via
 * /api/cron/broadcasts) claims each PENDING recipient atomically, sends via the
 * env-gated email channel, and finalises the broadcast to SENT.
 *
 * Contacts are DERIVED (no contacts table — see crm.ts), so the recipient
 * snapshot is the durable record of who a broadcast reached. All seller-facing
 * functions are tenant-scoped; the worker-facing ones are global (the cron runs
 * platform-wide, exactly like the sequences/recovery sweeps).
 */

export const BROADCAST_SEGMENTS = ["ALL", "CUSTOMERS", "LEADS"] as const;
export type BroadcastSegment = (typeof BROADCAST_SEGMENTS)[number];

/** Coerce untrusted input to a known segment (defaults to ALL). */
export function normalizeSegment(v: unknown): BroadcastSegment {
  return (BROADCAST_SEGMENTS as readonly string[]).includes(v as string)
    ? (v as BroadcastSegment)
    : "ALL";
}

/**
 * Pure predicate: does a contact belong to a segment?
 *   CUSTOMERS = has at least one paid order
 *   LEADS     = never paid (form-only or abandoned checkout)
 *   ALL       = everyone
 * Kept pure (no prisma) so it's unit-testable and reusable in the compose UI.
 */
export function matchesSegment(c: { paidCount: number }, segment: BroadcastSegment): boolean {
  if (segment === "CUSTOMERS") return c.paidCount >= 1;
  if (segment === "LEADS") return c.paidCount === 0;
  return true;
}

/** The resolved recipient contacts (with a non-empty email) for a segment. */
export async function recipientsForSegment(tenantId: string, segment: BroadcastSegment) {
  const contacts = await listContacts(tenantId);
  return contacts.filter((c) => c.email.trim() && matchesSegment(c, segment));
}

/** Contact counts per segment, for the compose screen. */
export async function segmentCounts(
  tenantId: string,
): Promise<Record<BroadcastSegment, number>> {
  const withEmail = (await listContacts(tenantId)).filter((c) => c.email.trim());
  return {
    ALL: withEmail.length,
    CUSTOMERS: withEmail.filter((c) => matchesSegment(c, "CUSTOMERS")).length,
    LEADS: withEmail.filter((c) => matchesSegment(c, "LEADS")).length,
  };
}

// ── Seller-scoped CRUD ───────────────────────────────────────────────────────

export function listBroadcasts(tenantId: string) {
  return prisma.broadcast.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export function getBroadcast(tenantId: string, id: string) {
  return prisma.broadcast.findFirst({ where: { id, tenantId } });
}

/** A broadcast with its recipient snapshot (for the detail view). */
export function getBroadcastWithRecipients(tenantId: string, id: string) {
  return prisma.broadcast.findFirst({
    where: { id, tenantId },
    include: { recipients: { orderBy: { createdAt: "asc" }, take: 500 } },
  });
}

export async function createBroadcast(
  tenantId: string,
  input: { name: string; subject: string; body: string; segment: BroadcastSegment },
) {
  return prisma.broadcast.create({
    data: {
      tenantId,
      name: input.name,
      subject: input.subject,
      body: input.body,
      segment: input.segment,
      status: "DRAFT",
    },
    select: { id: true },
  });
}

/** Update a DRAFT broadcast only — queued/sent broadcasts are immutable. */
export async function updateBroadcast(
  tenantId: string,
  id: string,
  input: { name: string; subject: string; body: string; segment: BroadcastSegment },
): Promise<boolean> {
  const res = await prisma.broadcast.updateMany({
    where: { id, tenantId, status: "DRAFT" },
    data: { name: input.name, subject: input.subject, body: input.body, segment: input.segment },
  });
  return res.count === 1;
}

/** Delete a broadcast that hasn't sent (DRAFT or CANCELLED). */
export async function deleteBroadcast(tenantId: string, id: string): Promise<boolean> {
  const res = await prisma.broadcast.deleteMany({
    where: { id, tenantId, status: { in: ["DRAFT", "CANCELLED"] } },
  });
  return res.count === 1;
}

/** Cancel a DRAFT/QUEUED broadcast → CANCELLED (the worker then ignores it). */
export async function cancelBroadcast(tenantId: string, id: string): Promise<boolean> {
  const res = await prisma.broadcast.updateMany({
    where: { id, tenantId, status: { in: ["DRAFT", "QUEUED"] } },
    data: { status: "CANCELLED" },
  });
  return res.count === 1;
}

/**
 * "Send" a DRAFT broadcast: snapshot the current segment into recipient rows and
 * flip the broadcast to QUEUED for the worker. The flip is guarded on status=DRAFT
 * (updateMany count check), so a double-click can't re-snapshot or re-queue.
 * Recipient inserts use skipDuplicates against the (broadcast,email) unique, so a
 * retry is harmless. Returns the recipient count, or null if not a sendable DRAFT.
 */
export async function queueBroadcast(tenantId: string, id: string): Promise<number | null> {
  const b = await prisma.broadcast.findFirst({ where: { id, tenantId } });
  if (!b || b.status !== "DRAFT") return null;

  const recipients = await recipientsForSegment(tenantId, normalizeSegment(b.segment));
  if (recipients.length > 0) {
    await prisma.broadcastRecipient.createMany({
      data: recipients.map((c) => ({
        broadcastId: id,
        email: c.email.toLowerCase(),
        name: c.name,
      })),
      skipDuplicates: true,
    });
  }
  const flip = await prisma.broadcast.updateMany({
    where: { id, tenantId, status: "DRAFT" },
    data: { status: "QUEUED", recipientCount: recipients.length, queuedAt: new Date() },
  });
  if (flip.count !== 1) return null;
  return recipients.length;
}

// ── Worker-facing (GLOBAL across tenants — the cron runs platform-wide) ───────

/** PENDING recipients of QUEUED/SENDING broadcasts, with broadcast + tenant. */
export function listDueBroadcastRecipients(limit = 200) {
  return prisma.broadcastRecipient.findMany({
    where: { status: "PENDING", broadcast: { status: { in: ["QUEUED", "SENDING"] } } },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: {
      broadcast: {
        select: {
          id: true,
          tenantId: true,
          subject: true,
          body: true,
          status: true,
          tenant: { select: { name: true, username: true, brandColor: true } },
        },
      },
    },
  });
}

/** Atomically claim a PENDING recipient → SENDING. Only the winner returns true. */
export async function claimBroadcastRecipient(id: string): Promise<boolean> {
  const res = await prisma.broadcastRecipient.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "SENDING" },
  });
  return res.count === 1;
}

/** Record the send result for a claimed recipient and bump the broadcast counters. */
export async function finishBroadcastRecipient(input: {
  id: string;
  broadcastId: string;
  status: "SENT" | "FAILED" | "SKIPPED";
  providerMessageId?: string | null;
  error?: string | null;
}): Promise<void> {
  await prisma.$transaction([
    prisma.broadcastRecipient.update({
      where: { id: input.id },
      data: {
        status: input.status,
        providerMessageId: input.providerMessageId ?? null,
        error: input.error ?? null,
        sentAt: new Date(),
      },
    }),
    prisma.broadcast.update({
      where: { id: input.broadcastId },
      data:
        input.status === "SENT"
          ? { sentCount: { increment: 1 } }
          : input.status === "FAILED"
            ? { failedCount: { increment: 1 } }
            : {}, // SKIPPED (env-gated off) counts as neither sent nor failed
    }),
  ]);
}

/** Flip a QUEUED broadcast → SENDING once the worker starts processing it. */
export function markBroadcastSending(id: string) {
  return prisma.broadcast.updateMany({
    where: { id, status: "QUEUED" },
    data: { status: "SENDING" },
  });
}

/**
 * Finalise any QUEUED/SENDING broadcast with no PENDING or SENDING recipients left
 * → SENT. (An empty-segment broadcast finalises on its first sweep.) Returns the
 * number finalised.
 */
export async function finalizeCompletedBroadcasts(): Promise<number> {
  const active = await prisma.broadcast.findMany({
    where: { status: { in: ["QUEUED", "SENDING"] } },
    select: { id: true },
  });
  let finalized = 0;
  for (const b of active) {
    const remaining = await prisma.broadcastRecipient.count({
      where: { broadcastId: b.id, status: { in: ["PENDING", "SENDING"] } },
    });
    if (remaining === 0) {
      const res = await prisma.broadcast.updateMany({
        where: { id: b.id, status: { in: ["QUEUED", "SENDING"] } },
        data: { status: "SENT", sentAt: new Date() },
      });
      finalized += res.count;
    }
  }
  return finalized;
}

// ── Admin (global oversight) ──────────────────────────────────────────────────

/** Recent broadcasts across all tenants, for the admin oversight page. */
export function listRecentBroadcasts(take = 50) {
  return prisma.broadcast.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      name: true,
      subject: true,
      segment: true,
      status: true,
      recipientCount: true,
      sentCount: true,
      failedCount: true,
      createdAt: true,
      sentAt: true,
      tenant: { select: { username: true, name: true } },
    },
  });
}
