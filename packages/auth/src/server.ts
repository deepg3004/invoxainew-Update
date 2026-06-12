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
