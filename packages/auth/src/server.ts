import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@invoxai/config";

// Re-export the edge-safe, session-bound client so server components can get
// everything auth-related from "@invoxai/auth/server".
export {
  createServerSupabaseClient,
  type CookieAdapter,
  type CookieToSet,
} from "./ssr";

/**
 * Service-role client — bypasses RLS. SERVER ONLY (this module is guarded by
 * `import "server-only"`), never in the browser and never in Edge middleware.
 * Use only for trusted tasks (webhooks, admin jobs). Pulls in @invoxai/config,
 * which uses node:fs — another reason it must not reach the Edge runtime.
 */
export function createServiceClient(): SupabaseClient {
  const env = serverEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

/** Public Storage bucket for uploaded images (logos, products, page images). */
export const MEDIA_BUCKET = "media";

/**
 * Upload image bytes to the public `media` bucket and return the public URL.
 * SERVER ONLY (service-role). Callers MUST auth-gate and validate type/size
 * BEFORE calling — this does the raw upload only. The object key is randomised
 * (uuid) under `keyPrefix` so filenames can't collide or be guessed/overwritten.
 */
export async function uploadPublicImage(opts: {
  bytes: ArrayBuffer;
  ext: string;
  contentType: string;
  keyPrefix: string;
}): Promise<string> {
  const sb = createServiceClient();
  const ext = (opts.ext || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
  const prefix = opts.keyPrefix.replace(/[^a-zA-Z0-9/_-]/g, "").replace(/^\/+|\/+$/g, "") || "misc";
  const key = `${prefix}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage
    .from(MEDIA_BUCKET)
    .upload(key, Buffer.from(opts.bytes), {
      contentType: opts.contentType,
      upsert: false,
      cacheControl: "31536000",
    });
  if (error) throw new Error(`upload failed: ${error.message}`);
  return sb.storage.from(MEDIA_BUCKET).getPublicUrl(key).data.publicUrl;
}

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
  "image/gif": "gif",
};

// ── Private downloads (hosted digital files) ─────────────────────────────────

/** PRIVATE Storage bucket for paid digital downloads. Never public — files are
 *  delivered only via short-lived signed URLs to the buyer who paid. */
export const DOWNLOADS_BUCKET = "downloads";
const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024; // 25 MB (matches the server-action body limit)

export type FileUploadResult =
  | { ok: true; key: string; name: string }
  | { ok: false; error: string };

/** Create the private downloads bucket if missing (idempotent). */
async function ensureDownloadsBucket(sb: SupabaseClient): Promise<void> {
  const { error } = await sb.storage.createBucket(DOWNLOADS_BUCKET, {
    public: false,
    fileSizeLimit: String(MAX_DOWNLOAD_BYTES),
  });
  // "already exists" is the normal path; anything else is fatal.
  if (error && !/exist/i.test(error.message)) throw new Error(error.message);
}

/**
 * Validate + store a seller's digital file (any type, ≤25 MB) in the PRIVATE
 * downloads bucket, returning the object KEY (never a URL — the key is never
 * exposed to buyers) + the original filename. SERVER ONLY (service-role); the
 * caller MUST auth-gate (requireTenant). The key is randomised under `keyPrefix`.
 */
export async function uploadPrivateFileFromForm(
  fd: FormData,
  keyPrefix: string,
): Promise<FileUploadResult> {
  const file = fd.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No file provided." };
  if (file.size === 0) return { ok: false, error: "The file is empty." };
  if (file.size > MAX_DOWNLOAD_BYTES) return { ok: false, error: "File must be under 25 MB." };

  const name = (file.name || "download").slice(0, 200);
  const dot = name.lastIndexOf(".");
  const ext =
    (dot > 0 ? name.slice(dot + 1) : "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) ||
    "bin";
  const prefix = keyPrefix.replace(/[^a-zA-Z0-9/_-]/g, "").replace(/^\/+|\/+$/g, "") || "misc";
  const key = `${prefix}/${crypto.randomUUID()}.${ext}`;

  try {
    const sb = createServiceClient();
    await ensureDownloadsBucket(sb);
    const bytes = await file.arrayBuffer();
    const { error } = await sb.storage.from(DOWNLOADS_BUCKET).upload(key, Buffer.from(bytes), {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (error) return { ok: false, error: "Upload failed. Please try again." };
    return { ok: true, key, name };
  } catch {
    return { ok: false, error: "Upload failed. Please try again." };
  }
}

/**
 * A short-lived signed URL to download a private file by its key, or null.
 * Generated SERVER-SIDE only, on a PAID + buyer-scoped page — the key itself is
 * never sent to the browser, only this expiring URL.
 *
 * Ownership boundary (defense-in-depth): pass `expectTenantId` and the key MUST
 * live under that tenant's `tenant/<id>/` prefix or we refuse to sign (returns
 * null). The seller-set `downloadKey` is client-forgeable, so this is the last
 * line that stops a seller from pointing their product at ANOTHER tenant's
 * private object and serving it to their own buyers via a valid signed URL.
 */
export async function createSignedDownloadUrl(
  key: string,
  expiresSec = 3600,
  expectTenantId?: string,
): Promise<string | null> {
  if (!key) return null;
  if (expectTenantId && !key.startsWith(`tenant/${expectTenantId}/`)) return null;
  try {
    const sb = createServiceClient();
    const { data, error } = await sb.storage
      .from(DOWNLOADS_BUCKET)
      .createSignedUrl(key, expiresSec);
    return error ? null : (data?.signedUrl ?? null);
  } catch {
    return null;
  }
}

/**
 * Remove a private object from the downloads bucket by key. SERVER ONLY; the
 * caller MUST auth-gate + verify ownership first (the key is a secret). Best-
 * effort — a failure is swallowed (the DB row is the source of truth; an orphaned
 * private object is inaccessible without its key anyway).
 */
export async function deletePrivateFile(key: string): Promise<void> {
  if (!key) return;
  try {
    const sb = createServiceClient();
    await sb.storage.from(DOWNLOADS_BUCKET).remove([key]);
  } catch {
    // swallow — orphaned private object is harmless.
  }
}

export type ImageUploadResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Validate an uploaded image from a FormData "file" field and store it. Used by
 * every app's image-upload server action — the action only adds the auth gate
 * (requireAdmin / requireTenant) and the storage key prefix. 5 MB cap; only
 * common image types. SERVER ONLY.
 */
export async function uploadImageFromForm(
  fd: FormData,
  keyPrefix: string,
): Promise<ImageUploadResult> {
  const file = fd.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No file provided." };
  const ext = EXT_BY_TYPE[file.type];
  if (!file.type.startsWith("image/") || !ext) {
    return { ok: false, error: "Unsupported image type (use PNG, JPG, WEBP, SVG, GIF or ICO)." };
  }
  if (file.size === 0) return { ok: false, error: "The file is empty." };
  if (file.size > 5 * 1024 * 1024) return { ok: false, error: "Image must be under 5 MB." };
  try {
    const bytes = await file.arrayBuffer();
    const url = await uploadPublicImage({ bytes, ext, contentType: file.type, keyPrefix });
    return { ok: true, url };
  } catch {
    return { ok: false, error: "Upload failed. Please try again." };
  }
}
