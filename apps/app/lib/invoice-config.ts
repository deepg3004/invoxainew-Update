import "server-only";
import { serverEnv } from "@invoxai/config";
import { getPlatformSettings } from "@invoxai/db";
import { safeUrl } from "@invoxai/utils/blocks";

/**
 * Resolve invoice/GST + logo config, admin DB settings first, env as fallback.
 * Admins manage these at admin.invoxai.io/settings without a redeploy; env stays
 * the default for a fresh install. gstRateBps only affects NEW invoices — past
 * invoices store the rate they were issued at.
 */
export async function getInvoiceConfig() {
  const env = serverEnv();
  const s = await getPlatformSettings();
  const rateRaw = s.invoice_gst_rate_bps;
  const gstRateBps =
    rateRaw && /^\d+$/.test(rateRaw) ? Number(rateRaw) : env.INVOICE_GST_RATE_BPS;
  return {
    legalName: s.invoice_legal_name || env.INVOICE_LEGAL_NAME,
    gstin: s.invoice_gstin || env.INVOICE_GSTIN,
    address: s.invoice_address || env.INVOICE_ADDRESS,
    gstRateBps,
    logoUrl: safeUrl(s.brand_logo_url ?? ""),
  };
}
