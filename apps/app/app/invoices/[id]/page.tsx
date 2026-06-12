import {formatDateIST} from "@invoxai/utils/date";
import Link from "next/link";
import { notFound } from "next/navigation";
import { serverEnv } from "@invoxai/config";
import { getInvoice } from "@invoxai/db";
import { formatRupees, bpsToPercentString } from "@invoxai/utils/money";
import { requireTenant } from "../../../lib/tenant";
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
  const env = serverEnv();
  const isTax = Boolean(env.INVOICE_GSTIN);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/invoices" className="text-sm text-cyan underline">
          ← Invoices
        </Link>
        <PrintButton />
      </div>

      <div className="mt-6 rounded-xl border border-zinc-200 bg-surface p-8">
        <div className="flex items-start justify-between">
          <div>
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
            Not a valid tax invoice — InvoxAI’s GSTIN is not yet configured.
          </p>
        ) : null}

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted">From</div>
            <div className="mt-1 text-sm">
              <div className="font-semibold text-zinc-900">{env.INVOICE_LEGAL_NAME}</div>
              {env.INVOICE_ADDRESS ? (
                <div className="whitespace-pre-line text-muted">{env.INVOICE_ADDRESS}</div>
              ) : null}
              {env.INVOICE_GSTIN ? (
                <div className="mt-1 text-muted">GSTIN: {env.INVOICE_GSTIN}</div>
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

        <table className="mt-8 w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-muted">
            <tr>
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-zinc-200">
              <td className="py-2">{inv.descriptionLine}</td>
              <td className="py-2 text-right">{formatRupees(inv.basePaise)}</td>
            </tr>
          </tbody>
        </table>

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
          {isTax ? "" : " Configure INVOICE_GSTIN to issue valid tax invoices."}
        </p>
      </div>
    </div>
  );
}
