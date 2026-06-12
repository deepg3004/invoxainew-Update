"use server";

import { revalidatePath } from "next/cache";
import { upsertPlatformSettings } from "@invoxai/db";
import { uploadImageFromForm, type ImageUploadResult } from "@invoxai/auth/server";
import { safeUrl } from "@invoxai/utils/blocks";
import { requireAdmin } from "../../lib/auth";

/** Upload a branding image (logo/favicon). Admin-only. */
export async function uploadBrandingImageAction(fd: FormData): Promise<ImageUploadResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { ok: false, error: "Not authorized." };
  return uploadImageFromForm(fd, "branding");
}

export type SettingsFormState = { error?: string; ok?: boolean };

// Standard Indian GSTIN: 2 state digits + 10-char PAN + entity + Z + checksum.
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function saveSettingsAction(
  _prev: SettingsFormState,
  form: FormData,
): Promise<SettingsFormState> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: "Not authorized." };

  const get = (k: string) => String(form.get(k) ?? "").trim();
  const legalName = get("invoice_legal_name");
  const gstin = get("invoice_gstin").toUpperCase();
  const address = get("invoice_address");
  const gstPercent = get("invoice_gst_rate_percent");
  const email = get("invoice_email");
  const phone = get("invoice_phone");
  const pan = get("invoice_pan").toUpperCase();
  const hsn = get("invoice_hsn");
  const numberPrefix = get("invoice_number_prefix").replace(/[^A-Za-z0-9]/g, "").slice(0, 12);
  const gstMode = get("invoice_gst_mode") === "CGST_SGST" ? "CGST_SGST" : "IGST";
  const footerNote = get("invoice_footer_note").slice(0, 400);
  const supportEmail = get("invoice_support_email");
  const logoUrlRaw = get("brand_logo_url");
  const faviconUrlRaw = get("brand_favicon_url");

  // GSTIN: optional, but if present must be a valid 15-char GSTIN (it prints on
  // tax invoices — a malformed one is worse than none).
  if (gstin && !GSTIN_RE.test(gstin)) {
    return { error: "GSTIN looks invalid — it must be the standard 15-character format (e.g. 27ABCDE1234F1Z5), or leave it blank." };
  }
  if (pan && !PAN_RE.test(pan)) {
    return { error: "PAN looks invalid — it must be 10 characters (e.g. ABCDE1234F), or leave it blank." };
  }
  if (hsn && !/^\d{4,8}$/.test(hsn)) {
    return { error: "HSN/SAC must be 4–8 digits (e.g. 998319), or leave it blank." };
  }
  if (email && !EMAIL_RE.test(email)) return { error: "Billing email looks invalid." };
  if (supportEmail && !EMAIL_RE.test(supportEmail)) return { error: "Support email looks invalid." };

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
      { key: "invoice_email", value: email },
      { key: "invoice_phone", value: phone },
      { key: "invoice_pan", value: pan },
      { key: "invoice_hsn", value: hsn },
      { key: "invoice_number_prefix", value: numberPrefix },
      { key: "invoice_gst_mode", value: gstMode },
      { key: "invoice_footer_note", value: footerNote },
      { key: "invoice_support_email", value: supportEmail },
      { key: "brand_logo_url", value: logoUrl },
      { key: "brand_favicon_url", value: faviconUrl },
    ],
    gate.user.email ?? "admin",
  );

  revalidatePath("/settings");
  return { ok: true };
}
