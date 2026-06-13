import { prisma } from "./client";

/**
 * Global platform settings (string key/value) — admin-managed config that used
 * to live in env. PLATFORM-GLOBAL: only the admin app writes these (after
 * requireAdmin), and they're the same for everyone (no tenant scoping).
 *
 * NOT for secrets (gateway/API keys, passwords) — those stay in env, encrypted.
 * This store is plaintext, non-secret config only.
 */

// Stable code keys. Anything not listed here is ignored on write.
export const PLATFORM_SETTING_KEYS = [
  "invoice_legal_name",
  "invoice_gstin",
  "invoice_address",
  "invoice_gst_rate_bps",
  "invoice_email",
  "invoice_phone",
  "invoice_pan",
  "invoice_hsn",
  "invoice_number_prefix",
  "invoice_gst_mode", // "IGST" | "CGST_SGST"
  "invoice_footer_note",
  "invoice_support_email",
  "brand_logo_url",
  "brand_favicon_url",
  // Manual-UPI auto-confirm: when a seller's outstanding DUE commission exceeds
  // this many paise, their instant UPI auto-confirm is paused (orders fall back
  // to manual confirm) until they top up. Default ₹500 (see getUpiDueBlockPaise).
  "upi_due_block_paise",
] as const;

export type PlatformSettingKey = (typeof PLATFORM_SETTING_KEYS)[number];
export type PlatformSettings = Partial<Record<PlatformSettingKey, string>>;

/** Default DUE-commission ceiling (paise) above which instant UPI is paused. */
export const UPI_DUE_BLOCK_DEFAULT_PAISE = 50000; // ₹500

/**
 * The DUE-commission ceiling (paise) above which a seller's instant UPI
 * auto-confirm is paused. Admin-configurable via `upi_due_block_paise`; falls
 * back to ₹500. A non-numeric / missing value uses the default.
 */
export async function getUpiDueBlockPaise(): Promise<number> {
  const row = await prisma.platformSetting.findUnique({
    where: { key: "upi_due_block_paise" },
    select: { value: true },
  });
  const n = row ? Number.parseInt(row.value, 10) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : UPI_DUE_BLOCK_DEFAULT_PAISE;
}

/** All settings as a key→value map (only non-empty rows). */
export async function getPlatformSettings(): Promise<PlatformSettings> {
  const rows = await prisma.platformSetting.findMany();
  const out: PlatformSettings = {};
  for (const r of rows) {
    if (PLATFORM_SETTING_KEYS.includes(r.key as PlatformSettingKey) && r.value !== "") {
      out[r.key as PlatformSettingKey] = r.value;
    }
  }
  return out;
}

/**
 * Public branding (logo + favicon URLs) — safe to read from any app (web/tenant)
 * since it's non-secret display config.
 */
export async function getBranding(): Promise<{ logoUrl?: string; faviconUrl?: string }> {
  const s = await getPlatformSettings();
  return { logoUrl: s.brand_logo_url, faviconUrl: s.brand_favicon_url };
}

/**
 * Bulk create-or-update settings (admin editor saves the whole form). Empty
 * strings are stored as "" (treated as unset on read), so clearing a field
 * works. Only known keys are written. Atomic, and writes one AdminAuditLog row
 * naming the keys changed.
 */
export async function upsertPlatformSettings(
  entries: { key: string; value: string }[],
  adminEmail: string,
): Promise<void> {
  const valid = entries.filter((e) =>
    PLATFORM_SETTING_KEYS.includes(e.key as PlatformSettingKey),
  );
  if (valid.length === 0) return;
  await prisma.$transaction([
    ...valid.map((e) =>
      prisma.platformSetting.upsert({
        where: { key: e.key },
        create: { key: e.key, value: e.value },
        update: { value: e.value },
      }),
    ),
    prisma.adminAuditLog.create({
      data: {
        adminEmail,
        action: "settings.update",
        detail: valid.map((e) => e.key).join(", "),
      },
    }),
  ]);
}
