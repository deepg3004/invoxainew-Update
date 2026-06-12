"use server";

import { revalidatePath } from "next/cache";
import { upsertPlatformSettings } from "@invoxai/db";
import { safeUrl } from "@invoxai/utils/blocks";
import { requireAdmin } from "../../lib/auth";

export type SettingsFormState = { error?: string; ok?: boolean };

// Standard Indian GSTIN: 2 state digits + 10-char PAN + entity + Z + checksum.
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export async function saveSettingsAction(
  _prev: SettingsFormState,
  form: FormData,
): Promise<SettingsFormState> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: "Not authorized." };

  const legalName = String(form.get("invoice_legal_name") ?? "").trim();
  const gstin = String(form.get("invoice_gstin") ?? "").trim().toUpperCase();
  const address = String(form.get("invoice_address") ?? "").trim();
  const gstPercent = String(form.get("invoice_gst_rate_percent") ?? "").trim();
  const logoUrlRaw = String(form.get("brand_logo_url") ?? "").trim();
  const faviconUrlRaw = String(form.get("brand_favicon_url") ?? "").trim();

  // GSTIN: optional, but if present must be a valid 15-char GSTIN (it prints on
  // tax invoices — a malformed one is worse than none).
  if (gstin && !GSTIN_RE.test(gstin)) {
    return { error: "GSTIN looks invalid — it must be the standard 15-character format (e.g. 27ABCDE1234F1Z5), or leave it blank." };
  }

  // GST rate: percent 0–28 → basis points.
  let gstRateBps = "";
  if (gstPercent) {
    const pct = Number(gstPercent);
    if (!Number.isFinite(pct) || pct < 0 || pct > 28) {
      return { error: "GST rate must be a number between 0 and 28 (percent)." };
    }
    gstRateBps = String(Math.round(pct * 100));
  }

  // Logo / favicon: only http(s) or site-relative URLs (rendered in <img>/<link>).
  const logoUrl = logoUrlRaw ? safeUrl(logoUrlRaw) : "";
  if (logoUrlRaw && !logoUrl) {
    return { error: "Logo URL must be a valid http(s) image URL." };
  }
  const faviconUrl = faviconUrlRaw ? safeUrl(faviconUrlRaw) : "";
  if (faviconUrlRaw && !faviconUrl) {
    return { error: "Favicon URL must be a valid http(s) image URL." };
  }

  await upsertPlatformSettings(
    [
      { key: "invoice_legal_name", value: legalName },
      { key: "invoice_gstin", value: gstin },
      { key: "invoice_address", value: address },
      { key: "invoice_gst_rate_bps", value: gstRateBps },
      { key: "brand_logo_url", value: logoUrl },
      { key: "brand_favicon_url", value: faviconUrl },
    ],
    gate.user.email ?? "admin",
  );

  revalidatePath("/settings");
  return { ok: true };
}
