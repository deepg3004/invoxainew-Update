import { formatDateIST } from "@invoxai/utils/date";
import { notFound } from "next/navigation";
import { getInvoice } from "@invoxai/db";
import { formatRupees, bpsToPercentString } from "@invoxai/utils/money";
import { Button, PageHeader } from "@invoxai/ui";
import { requireTenant } from "../../../lib/tenant";
import { getInvoiceConfig } from "../../../lib/invoice-config";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

function fmtDate(d: Date): string {
  return formatDateIST(d);
}

export default async function InvoiceDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenant, user } = await requireTenant();
  const { id } = await params;
  const inv = await getInvoice(tenant.id, id);
  if (!inv) notFound();
  const cfg = await getInvoiceConfig();
  const isTax = Boolean(cfg.gstin);

  // GST presentation: a single IGST line, or a CGST + SGST split (display only —
  // the stored tax amount is unchanged).
  const halfTax = Math.round(inv.taxPaise / 2);
  const halfRate = bpsToPercentString(Math.round(inv.gstRateBps / 2));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="print:hidden">
        <PageHeader
          eyebrow="InvoxAI · billing"
          title="Invoice"
          description={inv.number}
          actions={
            <>
              <Button href="/invoices" variant="secondary" size="sm">
                ← Invoices
              </Button>
              <PrintButton />
            </>
          }
        />
      </div>

      {/* The printable document */}
      <div className="rounded-xl border border-zinc-200 bg-white p-8 text-sm text-zinc-800 print:rounded-none print:border-0 print:p-0">
        {/* Header band */}
        <div className="flex items-center justify-between border-b-2 border-zinc-900 pb-4">
          <div>
            {cfg.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cfg.logoUrl} alt={cfg.legalName} className="h-9 w-auto" />
            ) : (
              <span className="font-display text-xl font-bold text-zinc-900">{cfg.legalName}</span>
            )}
          </div>
          <div className="text-xl font-bold tracking-wide text-zinc-900">
            {isTax ? "TAX INVOICE" : "INVOICE (DRAFT)"}
          </div>
        </div>

        {!isTax ? (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Not a valid tax invoice — set a GSTIN in admin settings.
          </p>
        ) : null}

        {/* Bill from / invoice meta */}
        <div className="mt-6 flex flex-wrap justify-between gap-6">
          <div className="max-w-xs">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Bill from</div>
            <div className="mt-1 font-semibold text-zinc-900">{cfg.legalName}</div>
            {cfg.address ? <div className="whitespace-pre-line text-zinc-600">{cfg.address}</div> : null}
            {cfg.email ? <div className="mt-1 text-zinc-600">Email: {cfg.email}</div> : null}
            {cfg.phone ? <div className="text-zinc-600">Phone: {cfg.phone}</div> : null}
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Invoice no.</div>
            <div className="font-medium text-zinc-900">{inv.number}</div>
            <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Invoice date</div>
            <div className="text-zinc-900">{fmtDate(inv.issuedAt)}</div>
            {cfg.gstin ? (
              <>
                <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">GSTIN</div>
                <div className="text-zinc-900">{cfg.gstin}</div>
              </>
            ) : null}
            {cfg.pan ? (
              <>
                <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">PAN</div>
                <div className="text-zinc-900">{cfg.pan}</div>
              </>
            ) : null}
          </div>
        </div>

        {/* Bill to */}
        <div className="mt-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Bill to</div>
          <div className="mt-1 font-semibold text-zinc-900">{tenant.name ?? tenant.username}</div>
          <div className="text-zinc-600">{tenant.username}.invoxai.io</div>
          {user.email ? <div className="text-zinc-600">{user.email}</div> : null}
        </div>

        {/* Line items */}
        <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200">
          <table className="w-full text-left">
            <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-2.5">Description</th>
                <th className="px-4 py-2.5 text-center">Qty</th>
                <th className="px-4 py-2.5 text-right">Unit price</th>
                <th className="px-4 py-2.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-zinc-100">
                <td className="px-4 py-3">
                  {inv.descriptionLine}
                  {cfg.hsn ? <span className="ml-1 text-zinc-500">[HSN/SAC: {cfg.hsn}]</span> : null}
                </td>
                <td className="px-4 py-3 text-center">01</td>
                <td className="px-4 py-3 text-right">{formatRupees(inv.basePaise)}</td>
                <td className="px-4 py-3 text-right">{formatRupees(inv.basePaise)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mt-4 ml-auto w-full max-w-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-zinc-500">Sub total</span>
            <span>{formatRupees(inv.basePaise)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Discount</span>
            <span>{formatRupees(0)}</span>
          </div>
          {cfg.gstMode === "CGST_SGST" ? (
            <>
              <div className="flex justify-between">
                <span className="text-zinc-500">CGST @ {halfRate}%</span>
                <span>{formatRupees(halfTax)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">SGST @ {halfRate}%</span>
                <span>{formatRupees(inv.taxPaise - halfTax)}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between">
              <span className="text-zinc-500">IGST @ {bpsToPercentString(inv.gstRateBps)}%</span>
              <span>{formatRupees(inv.taxPaise)}</span>
            </div>
          )}
          <div className="flex justify-between rounded-md bg-zinc-100 px-2 py-1.5 font-semibold text-zinc-900">
            <span>Total amount</span>
            <span>{formatRupees(inv.totalPaise)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 border-t border-zinc-200 pt-3 text-xs text-zinc-500">
          <p>
            {cfg.footerNote}
            {cfg.supportEmail ? ` In case of support contact ${cfg.supportEmail}.` : ""}
          </p>
          <p className="mt-1">
            Amount is inclusive of GST.
            {isTax ? "" : " Set a GSTIN in admin settings to issue valid tax invoices."}
          </p>
        </div>
      </div>
    </div>
  );
}
