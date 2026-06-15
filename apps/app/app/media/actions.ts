"use server";

import { revalidatePath } from "next/cache";
import {
  uploadPrivateFileFromForm,
  createSignedDownloadUrl,
  deletePrivateFile,
} from "@invoxai/auth/server";
import {
  createFileAsset,
  getFileAsset,
  deleteFileAsset,
  tenantStorageBytes,
} from "@invoxai/db";
import { DEFAULT_STORAGE_BYTES, exceedsStorageLimit } from "@invoxai/utils/bytes";
import { requireTenant } from "../../lib/tenant";

const MAX_FILE_BYTES = 25 * 1024 * 1024;

export type UploadMediaResult = { ok: true } | { ok: false; error: string };

/**
 * Upload a file into the seller's media library. Size/type are read from the File
 * here (the storage helper doesn't return them), the storage limit is re-checked
 * server-trusted, then the object is stored under the tenant's key prefix and a
 * FileAsset catalog row is recorded.
 */
export async function uploadMediaAction(fd: FormData): Promise<UploadMediaResult> {
  const { tenant } = await requireTenant();

  const file = fd.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No file provided." };
  if (file.size === 0) return { ok: false, error: "The file is empty." };
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: "File must be under 25 MB." };

  const used = await tenantStorageBytes(tenant.id);
  if (exceedsStorageLimit(used, file.size, DEFAULT_STORAGE_BYTES)) {
    return { ok: false, error: "Storage limit reached — delete some files or upgrade your plan." };
  }

  const sizeBytes = file.size;
  const contentType = file.type || "application/octet-stream";
  const stored = await uploadPrivateFileFromForm(fd, `tenant/${tenant.id}`);
  if (!stored.ok) return { ok: false, error: stored.error };

  await createFileAsset({
    tenantId: tenant.id,
    key: stored.key,
    name: stored.name,
    sizeBytes,
    contentType,
  });
  revalidatePath("/media");
  return { ok: true };
}

/** Delete a file: remove the storage object (best-effort) + the catalog row. */
export async function deleteMediaAction(id: string): Promise<void> {
  const { tenant } = await requireTenant();
  const asset = await getFileAsset(tenant.id, id);
  if (!asset) return;
  await deletePrivateFile(asset.key);
  await deleteFileAsset(tenant.id, id);
  revalidatePath("/media");
}

export type SignedUrlResult = { ok: true; url: string } | { ok: false };

/** A short-lived signed download URL for the seller's own file (tenant-scoped). */
export async function mediaDownloadUrlAction(id: string): Promise<SignedUrlResult> {
  const { tenant } = await requireTenant();
  const asset = await getFileAsset(tenant.id, id);
  if (!asset) return { ok: false };
  const url = await createSignedDownloadUrl(asset.key, 3600, tenant.id);
  return url ? { ok: true, url } : { ok: false };
}
