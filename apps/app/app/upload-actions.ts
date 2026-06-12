"use server";

import { uploadImageFromForm, type ImageUploadResult } from "@invoxai/auth/server";
import { requireTenant } from "../lib/tenant";

/** Upload an image for the signed-in seller (product images, AI-page images,
 *  bio avatar…). Stored under the tenant's own key prefix. */
export async function uploadTenantImageAction(fd: FormData): Promise<ImageUploadResult> {
  const { tenant } = await requireTenant();
  return uploadImageFromForm(fd, `tenant/${tenant.id}`);
}
