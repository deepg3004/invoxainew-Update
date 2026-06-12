import {formatDateIST} from "@invoxai/utils/date";
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

  return (
    <div className="mx-auto max-w-6xl">
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

      <div className="mt-6 rounded-xl border border-zinc-200 bg-surface p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            {cfg.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cfg.logoUrl} alt={cfg.legalName} className="mb-3 h-9 w-auto" />
            ) : null}
            <h1 className="text-xl font-bold">
              {isTax ? "Tax Invoice" : "Invoice (DRAFT)"}
            </h1>
            <p className="mt-1 text-sm text-muted">{inv.number}</p>
          </div>
          <div className="text-right text-sm text-muted">
            Date: {fmtDate(inv.issuedAt)}
          </div>
        </div>

        {!isTax ? (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Not a valid tax invoice — a GSTIN is not yet configured.
          </p>
        ) : null}

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted">From</div>
            <div className="mt-1 text-sm">
              <div className="font-semibold text-zinc-900">{cfg.legalName}</div>
              {cfg.address ? (
                <div className="whitespace-pre-line text-muted">{cfg.address}</div>
              ) : null}
              {cfg.gstin ? (
                <div className="mt-1 text-muted">GSTIN: {cfg.gstin}</div>
              ) : null}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted">Billed to</div>
            <div className="mt-1 text-sm">
              <div className="font-semibold text-zinc-900">{tenant.name ?? tenant.username}</div>
              <div className="text-muted">{tenant.username}.invoxai.io</div>
              <div className="text-muted">{user.email}</div>
            </div>
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-xl border border-zinc-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-zinc-100 hover:bg-zinc-50">
                <td className="px-4 py-3">{inv.descriptionLine}</td>
                <td className="px-4 py-3 text-right">{formatRupees(inv.basePaise)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 ml-auto w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Taxable value</span>
            <span>{formatRupees(inv.basePaise)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">
              GST @ {bpsToPercentString(inv.gstRateBps)}%
            </span>
            <span>{formatRupees(inv.taxPaise)}</span>
          </div>
          <div className="flex justify-between border-t border-zinc-200 pt-1 font-semibold">
            <span>Total</span>
            <span>{formatRupees(inv.totalPaise)}</span>
          </div>
        </div>

        <p className="mt-8 text-xs text-muted">
          Amount is inclusive of GST. Computer-generated invoice.
          {isTax ? "" : " Set a GSTIN in admin settings to issue valid tax invoices."}
        </p>
      </div>
    </div>
  );
}
