import { getPlatformSettings } from "@invoxai/db";

/**
 * Company / legal entity details for the public legal pages, sourced from the
 * admin-configured platform settings (the same values used on tax invoices) with
 * safe fallbacks. Where a value isn't configured yet, a clearly-bracketed
 * placeholder is returned so the admin knows to fill it in admin → Settings.
 */
export type Company = {
  legalName: string;
  address: string;
  supportEmail: string;
  phone: string | null;
  gstin: string | null;
  effectiveDate: string;
  appUrl: string;
  rootDomain: string;
};

export async function getCompany(): Promise<Company> {
  const s = await getPlatformSettings().catch(() => ({}) as Record<string, string | undefined>);
  return {
    legalName: s.invoice_legal_name?.trim() || "InvoxAI",
    address: s.invoice_address?.trim() || "[Registered address — set in admin → Settings]",
    supportEmail:
      s.invoice_support_email?.trim() || s.invoice_email?.trim() || "support@invoxai.io",
    phone: s.invoice_phone?.trim() || null,
    gstin: s.invoice_gstin?.trim() || null,
    effectiveDate: "13 June 2026",
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://app.invoxai.io",
    rootDomain: process.env.NEXT_PUBLIC_ROOT_DOMAIN || "invoxai.io",
  };
}
