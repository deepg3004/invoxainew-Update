"use server";

import { revalidatePath } from "next/cache";
import {
  submitVerification,
  addKycDocument,
  getKycDocument,
  deleteKycDocument,
  isKycDocType,
  logActivity,
} from "@invoxai/db";
import { deletePrivateFile } from "@invoxai/auth/server";
import { requireTenant } from "../../lib/tenant";

export type VerificationFormState = { error?: string; ok?: boolean };
export type KycDocFormState = { error?: string; ok?: boolean };

/** Seller submits business details for verification → PENDING. */
export async function submitVerificationAction(
  _prev: VerificationFormState,
  form: FormData,
): Promise<VerificationFormState> {
  const { tenant } = await requireTenant();

  const legalName = String(form.get("legalName") ?? "").trim();
  const details = String(form.get("details") ?? "").trim();
  if (!legalName) return { error: "Enter your business / legal name." };

  const note = `Legal/business name: ${legalName}${details ? `\n\n${details}` : ""}`;
  const res = await submitVerification(tenant.id, note);
  if (res.count === 0) {
    return { error: "You can't submit right now — you may already be verified or under review." };
  }
  revalidatePath("/verification");
  return { ok: true };
}

/**
 * Record an uploaded KYC document for the signed-in seller. The file was already
 * stored in PRIVATE storage by uploadKycDocAction (which returns the key + name
 * into the form's hidden inputs). Defense-in-depth: the key MUST live under this
 * tenant's `tenant/<id>/kyc/` prefix — so a forged key from the browser can't
 * attach another tenant's object. Tenant-scoped throughout.
 */
export async function addKycDocumentAction(
  _prev: KycDocFormState,
  form: FormData,
): Promise<KycDocFormState> {
  const { tenant } = await requireTenant();

  const docType = String(form.get("docType") ?? "").trim();
  if (!isKycDocType(docType)) return { error: "Pick a document type." };

  const storageKey = String(form.get("storageKey") ?? "").trim();
  const fileName = String(form.get("fileName") ?? "").trim();
  if (!storageKey || !fileName) return { error: "Choose a file to upload first." };
  if (!storageKey.startsWith(`tenant/${tenant.id}/kyc/`)) {
    return { error: "That file couldn’t be verified — please upload it again." };
  }

  await addKycDocument({ tenantId: tenant.id, docType, fileName, storageKey });
  await logActivity(tenant.id, "kyc.document_uploaded", `${docType}: ${fileName}`).catch(() => {});
  revalidatePath("/verification");
  return { ok: true };
}

/** Seller removes one of their own KYC documents (storage object + row). */
export async function deleteKycDocumentAction(docId: string) {
  const { tenant } = await requireTenant();
  const doc = await getKycDocument(tenant.id, docId);
  if (!doc) return;
  await deletePrivateFile(doc.storageKey);
  await deleteKycDocument(tenant.id, docId);
  await logActivity(tenant.id, "kyc.document_removed", doc.fileName).catch(() => {});
  revalidatePath("/verification");
}
