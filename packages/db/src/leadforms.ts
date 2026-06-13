import { Prisma, type LeadFormStatus } from "@prisma/client";
import { prisma } from "./client";

export type CreateLeadFormResult =
  | { ok: true; id: string }
  | { ok: false; reason: "slug_taken" };

export interface LeadFormInput {
  title: string;
  description?: string | null;
  buttonLabel?: string;
  successMessage?: string | null;
  collectPhone?: boolean;
  collectMessage?: boolean;
}

/** Create a lead form. Slug is passed in (app slugifies the title); a clash with
 *  an existing form on this tenant returns slug_taken. Starts as DRAFT. */
export async function createLeadForm(
  tenantId: string,
  slug: string,
  input: LeadFormInput,
): Promise<CreateLeadFormResult> {
  try {
    const form = await prisma.leadForm.create({
      data: {
        tenantId,
        slug,
        title: input.title,
        description: input.description ?? null,
        buttonLabel: input.buttonLabel?.trim() || "Submit",
        successMessage: input.successMessage ?? null,
        collectPhone: input.collectPhone ?? true,
        collectMessage: input.collectMessage ?? true,
      },
      select: { id: true },
    });
    return { ok: true, id: form.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, reason: "slug_taken" };
    }
    throw e;
  }
}

/** A seller's lead forms, newest first, with a submission count. Tenant-scoped. */
export function listLeadForms(tenantId: string, opts: { skip?: number; take?: number } = {}) {
  return prisma.leadForm.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { submissions: true } } },
    skip: opts.skip,
    take: opts.take,
  });
}

export function countLeadForms(tenantId: string) {
  return prisma.leadForm.count({ where: { tenantId } });
}

/** A lead form owned by this tenant (seller scope). */
export function getLeadFormById(tenantId: string, id: string) {
  return prisma.leadForm.findFirst({ where: { id, tenantId } });
}

/** A PUBLISHED lead form by slug for the public site (host-resolved tenant). */
export function getPublishedLeadForm(tenantId: string, slug: string) {
  return prisma.leadForm.findFirst({
    where: { tenantId, slug, status: "PUBLISHED" },
  });
}

export function updateLeadForm(tenantId: string, id: string, input: LeadFormInput) {
  // Scoped to the owner via updateMany (where includes tenantId).
  return prisma.leadForm.updateMany({
    where: { id, tenantId },
    data: {
      title: input.title,
      description: input.description ?? null,
      buttonLabel: input.buttonLabel?.trim() || "Submit",
      successMessage: input.successMessage ?? null,
      collectPhone: input.collectPhone ?? true,
      collectMessage: input.collectMessage ?? true,
    },
  });
}

export function setLeadFormStatus(
  tenantId: string,
  id: string,
  status: LeadFormStatus,
) {
  return prisma.leadForm.updateMany({ where: { id, tenantId }, data: { status } });
}

/**
 * Record a public lead submission. SECURITY: re-validates that the form belongs
 * to the host-resolved tenant AND is PUBLISHED before inserting, so a forged
 * formId can't drop a row under another tenant or into a draft form. The
 * tenant_id is stamped from the verified form, never trusted from the client.
 */
export async function submitLead(input: {
  tenantId: string;
  formId: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  message?: string | null;
}): Promise<{ ok: boolean }> {
  const form = await prisma.leadForm.findFirst({
    where: { id: input.formId, tenantId: input.tenantId, status: "PUBLISHED" },
    select: { id: true, tenantId: true },
  });
  if (!form) return { ok: false };

  await prisma.leadSubmission.create({
    data: {
      tenantId: form.tenantId,
      formId: form.id,
      name: input.name?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      message: input.message?.trim() || null,
    },
  });
  return { ok: true };
}

/** Submissions for one of the seller's forms, newest first. Tenant-scoped. */
export function listLeadSubmissions(tenantId: string, formId: string, take = 200) {
  return prisma.leadSubmission.findMany({
    where: { tenantId, formId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

/** Total submissions across the tenant's forms (dashboard badge). */
export function countLeadSubmissions(tenantId: string) {
  return prisma.leadSubmission.count({ where: { tenantId } });
}
