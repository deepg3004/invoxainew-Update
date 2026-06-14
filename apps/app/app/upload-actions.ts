"use server";

import {
  uploadImageFromForm,
  uploadPrivateFileFromForm,
  type ImageUploadResult,
  type FileUploadResult,
} from "@invoxai/auth/server";
import { requireTenant } from "../lib/tenant";

/** Upload an image for the signed-in seller (product images, AI-page images,
 *  bio avatar…). Stored under the tenant's own key prefix. */
export async function uploadTenantImageAction(fd: FormData): Promise<ImageUploadResult> {
  const { tenant } = await requireTenant();
  return uploadImageFromForm(fd, `tenant/${tenant.id}`);
}

/** Upload a digital download file for the signed-in seller into PRIVATE storage,
 *  under the tenant's own key prefix. Returns the opaque key + filename. */
export async function uploadDownloadAction(fd: FormData): Promise<FileUploadResult> {
  const { tenant } = await requireTenant();
  return uploadPrivateFileFromForm(fd, `tenant/${tenant.id}`);
}

/** Upload a KYC / verification document into PRIVATE storage under the tenant's
 *  own `tenant/<id>/kyc/` prefix. Returns the opaque key + filename. The key
 *  stays under the tenant prefix so the signed-URL guard can verify ownership. */
export async function uploadKycDocAction(fd: FormData): Promise<FileUploadResult> {
  const { tenant } = await requireTenant();
  return uploadPrivateFileFromForm(fd, `tenant/${tenant.id}/kyc`);
}
