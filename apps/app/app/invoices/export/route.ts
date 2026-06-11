import { listInvoices } from "@invoxai/db";
import { paiseToRupeeString, bpsToPercentString } from "@invoxai/utils/money";
import { requireTenant } from "../../../lib/tenant";
import { toCsv, csvResponse } from "../../../lib/csv";

export const dynamic = "force-dynamic";

/** Seller tax-invoice export (CSV download). Tenant-scoped via the session. */
export async function GET() {
  const { tenant } = await requireTenant();
  const invoices = await listInvoices(tenant.id);

  const csv = toCsv(
    [
      "Invoice number",
      "Issued at",
      "Description",
      "Taxable value (INR)",
      "GST rate (%)",
      "GST (INR)",
      "Total (INR)",
    ],
    invoices.map((i) => [
      i.number,
      i.issuedAt.toISOString(),
      i.descriptionLine,
      paiseToRupeeString(i.basePaise),
      bpsToPercentString(i.gstRateBps),
      paiseToRupeeString(i.taxPaise),
      paiseToRupeeString(i.totalPaise),
    ]),
  );

  return csvResponse(`invoxai-invoices-${tenant.username}.csv`, csv);
}
