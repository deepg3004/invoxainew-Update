import { prisma } from "./client";
import type { SequenceTrigger } from "@prisma/client";

/**
 * Growth G1.3 — email/DM drip sequences (Part 1: seller-managed catalog).
 *
 * A sequence has an ordered list of steps; a trigger event enrols a contact (by
 * email — the CRM is derived, no contacts table) and the Part 2 worker advances
 * each enrolment by its step delays. This module is the seller CRUD only; it writes
 * NO enrollments and sends nothing. Carries no money.
 *
 * Tenant isolation: every read/write is scoped by tenantId. Step writes re-check
 * that the parent sequence belongs to the caller's tenant (a step has no tenantId of
 * its own), so a forged sequenceId can't touch another tenant's steps.
 */

export interface SequenceInput {
  name: string;
  trigger: SequenceTrigger;
  triggerProductId?: string | null;
  active?: boolean;
}

export interface StepInput {
  delayHours: number;
  subject?: string | null;
  body: string;
}

export type SaveSequenceResult =
  | { ok: true; id: string }
  | { ok: false; reason: "trigger_not_found" | "not_owned" };

async function ownsProduct(tenantId: string, productId: string): Promise<boolean> {
  const p = await prisma.product.findFirst({ where: { id: productId, tenantId }, select: { id: true } });
  return Boolean(p);
}

/** True iff this sequence belongs to the tenant (gate for step mutations). */
async function ownsSequence(tenantId: string, sequenceId: string): Promise<boolean> {
  const s = await prisma.emailSequence.findFirst({
    where: { id: sequenceId, tenantId },
    select: { id: true },
  });
  return Boolean(s);
}

export async function createSequence(
  tenantId: string,
  input: SequenceInput,
): Promise<SaveSequenceResult> {
  // PURCHASE may gate on a product; LEAD/MANUAL never carry a product.
  const triggerProductId =
    input.trigger === "PURCHASE" ? input.triggerProductId ?? null : null;
  if (triggerProductId && !(await ownsProduct(tenantId, triggerProductId))) {
    return { ok: false, reason: "trigger_not_found" };
  }
  const row = await prisma.emailSequence.create({
    data: {
      tenantId,
      name: input.name,
      trigger: input.trigger,
      triggerProductId,
      active: input.active ?? true,
    },
    select: { id: true },
  });
  return { ok: true, id: row.id };
}

/** A seller's sequences with step + active-enrolment counts. Scoped. */
export function listSequences(tenantId: string) {
  return prisma.emailSequence.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    include: {
      triggerProduct: { select: { title: true } },
      _count: { select: { steps: true, enrollments: true } },
    },
  });
}

/** One sequence with its ordered steps, for the edit page. Scoped. */
export function getSequenceWithSteps(tenantId: string, id: string) {
  return prisma.emailSequence.findFirst({
    where: { id, tenantId },
    include: { steps: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function updateSequence(
  tenantId: string,
  id: string,
  input: SequenceInput,
): Promise<SaveSequenceResult> {
  if (!(await ownsSequence(tenantId, id))) return { ok: false, reason: "not_owned" };
  const triggerProductId =
    input.trigger === "PURCHASE" ? input.triggerProductId ?? null : null;
  if (triggerProductId && !(await ownsProduct(tenantId, triggerProductId))) {
    return { ok: false, reason: "trigger_not_found" };
  }
  await prisma.emailSequence.updateMany({
    where: { id, tenantId },
    data: { name: input.name, trigger: input.trigger, triggerProductId },
  });
  return { ok: true, id };
}

export function setSequenceActive(tenantId: string, id: string, active: boolean) {
  return prisma.emailSequence.updateMany({ where: { id, tenantId }, data: { active } });
}

export function deleteSequence(tenantId: string, id: string) {
  return prisma.emailSequence.deleteMany({ where: { id, tenantId } });
}

// ── Steps ────────────────────────────────────────────────────────────────────

/** Append a step to the end of a sequence (next sortOrder). Tenant-gated. */
export async function addStep(
  tenantId: string,
  sequenceId: string,
  input: StepInput,
): Promise<{ ok: boolean }> {
  if (!(await ownsSequence(tenantId, sequenceId))) return { ok: false };
  const last = await prisma.sequenceStep.findFirst({
    where: { sequenceId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  await prisma.sequenceStep.create({
    data: {
      sequenceId,
      sortOrder: (last?.sortOrder ?? -1) + 1,
      delayHours: input.delayHours,
      subject: input.subject ?? null,
      body: input.body,
    },
  });
  return { ok: true };
}

/** Edit a step (tenant-gated via its parent sequence). */
export async function updateStep(
  tenantId: string,
  stepId: string,
  input: StepInput,
): Promise<{ ok: boolean }> {
  const step = await prisma.sequenceStep.findUnique({
    where: { id: stepId },
    select: { sequence: { select: { tenantId: true } } },
  });
  if (!step || step.sequence.tenantId !== tenantId) return { ok: false };
  await prisma.sequenceStep.update({
    where: { id: stepId },
    data: { delayHours: input.delayHours, subject: input.subject ?? null, body: input.body },
  });
  return { ok: true };
}

/** Delete a step (tenant-gated via its parent sequence). */
export async function deleteStep(tenantId: string, stepId: string): Promise<{ ok: boolean }> {
  const step = await prisma.sequenceStep.findUnique({
    where: { id: stepId },
    select: { sequence: { select: { tenantId: true } } },
  });
  if (!step || step.sequence.tenantId !== tenantId) return { ok: false };
  await prisma.sequenceStep.delete({ where: { id: stepId } });
  return { ok: true };
}

/** Published products a seller can gate a PURCHASE sequence on. */
export function listProductOptionsForSequence(tenantId: string) {
  return prisma.product.findMany({
    where: { tenantId, status: "PUBLISHED" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: { id: true, title: true },
  });
}

// ── Part 2: enrolment + the advance engine ───────────────────────────────────

/**
 * Enrol an email into every ACTIVE sequence of `tenantId` matching `trigger`. For
 * PURCHASE, a product-gated sequence only matches when `productId` equals its gate
 * (an ungated sequence matches any purchase). Idempotent: the unique (sequenceId,
 * email) means a repeated trigger never double-enrols. Sequences with no steps are
 * skipped. `nextRunAt` is set from the FIRST step's delay. Best-effort by design —
 * call after the money path; returns how many new enrolments were created.
 */
export async function enrollInSequences(input: {
  tenantId: string;
  trigger: SequenceTrigger;
  email: string | null | undefined;
  productId?: string | null;
}): Promise<number> {
  const email = input.email?.trim().toLowerCase();
  if (!email) return 0;

  const seqs = await prisma.emailSequence.findMany({
    where: {
      tenantId: input.tenantId,
      trigger: input.trigger,
      active: true,
      ...(input.trigger === "PURCHASE"
        ? {
            OR: [
              { triggerProductId: null },
              ...(input.productId ? [{ triggerProductId: input.productId }] : []),
            ],
          }
        : {}),
    },
    select: { id: true, steps: { orderBy: { sortOrder: "asc" }, take: 1, select: { delayHours: true } } },
  });

  let enrolled = 0;
  for (const s of seqs) {
    const first = s.steps[0];
    if (!first) continue; // no steps → nothing to send
    const nextRunAt = new Date(Date.now() + first.delayHours * 3_600_000);
    try {
      await prisma.sequenceEnrollment.create({
        data: { tenantId: input.tenantId, sequenceId: s.id, email, currentStep: 0, nextRunAt, status: "ACTIVE" },
      });
      enrolled++;
    } catch {
      // unique(sequenceId,email) → already enrolled; idempotent skip.
    }
  }
  return enrolled;
}

/** Enrol the buyer of a PAID order into matching PURCHASE sequences (reads the order's
 *  tenant + email + product, applies the product gate). Best-effort convenience for the
 *  post-sale path. Returns the count of new enrolments. */
export async function enrollPurchaseFromOrder(buyerPaymentId: string): Promise<number> {
  const o = await prisma.buyerPayment.findUnique({
    where: { id: buyerPaymentId },
    select: { tenantId: true, buyerEmail: true, productId: true },
  });
  if (!o) return 0;
  return enrollInSequences({
    tenantId: o.tenantId,
    trigger: "PURCHASE",
    email: o.buyerEmail,
    productId: o.productId,
  });
}

/** Enrolments due to fire (status ACTIVE, nextRunAt ≤ now), with their sequence +
 *  ordered steps + tenant, for the worker. GLOBAL across tenants. */
export function listDueEnrollments(limit = 200) {
  return prisma.sequenceEnrollment.findMany({
    where: { status: "ACTIVE", nextRunAt: { lte: new Date() } },
    orderBy: { nextRunAt: "asc" },
    take: limit,
    include: {
      sequence: {
        select: {
          active: true,
          tenant: { select: { name: true, username: true, brandColor: true } },
          steps: {
            orderBy: { sortOrder: "asc" },
            select: { id: true, delayHours: true, subject: true, body: true },
          },
        },
      },
    },
  });
}

/**
 * Atomically advance one enrolment from `fromStep` (guards on the current pointer so
 * two concurrent workers can't both process the same step). Returns true only for the
 * winner, which then sends `steps[fromStep]`. DONE when no steps remain.
 */
export async function claimEnrollmentAdvance(
  id: string,
  fromStep: number,
  next:
    | { status: "ACTIVE"; currentStep: number; nextRunAt: Date }
    | { status: "DONE" },
): Promise<boolean> {
  const res = await prisma.sequenceEnrollment.updateMany({
    where: { id, status: "ACTIVE", currentStep: fromStep },
    data:
      next.status === "DONE"
        ? { status: "DONE" }
        : { currentStep: next.currentStep, nextRunAt: next.nextRunAt },
  });
  return res.count === 1;
}
