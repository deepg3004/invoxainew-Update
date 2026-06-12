import "server-only";
import { serverEnv } from "@invoxai/config";
import { getPlatformSettings } from "@invoxai/db";
import { safeUrl } from "@invoxai/utils/blocks";

export type GstMode = "IGST" | "CGST_SGST";

export interface InvoiceConfig {
  legalName: string;
  gstin: string;
  address: string;
  gstRateBps: number;
  email: string;
  phone: string;
  pan: string;
  hsn: string;
  numberPrefix: string;
  gstMode: GstMode;
  footerNote: string;
  supportEmail: string;
  logoUrl: string;
}

const DEFAULT_FOOTER =
  "This is a computer generated receipt and does not require a signature.";

/**
 * Resolve invoice/GST + branding config — admin DB settings first, env fallback,
 * then sensible defaults. Admins manage these at admin.invoxai.io/settings.
 * gstRateBps / numberPrefix only affect NEW invoices; past invoices store the
 * rate and number they were issued with. gstMode/hsn/footer are render-time, so
 * changing them updates how existing invoices print too.
 */
export async function getInvoiceConfig(): Promise<InvoiceConfig> {
  const env = serverEnv();
  const s = await getPlatformSettings();
  const rateRaw = s.invoice_gst_rate_bps;
  const gstRateBps =
    rateRaw && /^\d+$/.test(rateRaw) ? Number(rateRaw) : env.INVOICE_GST_RATE_BPS;
  const prefixRaw = (s.invoice_number_prefix ?? "").replace(/[^A-Za-z0-9]/g, "");
  return {
    legalName: s.invoice_legal_name || env.INVOICE_LEGAL_NAME,
    gstin: s.invoice_gstin || env.INVOICE_GSTIN,
    address: s.invoice_address || env.INVOICE_ADDRESS,
    gstRateBps,
    email: s.invoice_email ?? "",
    phone: s.invoice_phone ?? "",
    pan: s.invoice_pan ?? "",
    hsn: s.invoice_hsn ?? "",
    numberPrefix: prefixRaw || "INV",
    gstMode: s.invoice_gst_mode === "CGST_SGST" ? "CGST_SGST" : "IGST",
    footerNote: s.invoice_footer_note || DEFAULT_FOOTER,
    supportEmail: s.invoice_support_email ?? "",
    logoUrl: safeUrl(s.brand_logo_url ?? ""),
  };
}
