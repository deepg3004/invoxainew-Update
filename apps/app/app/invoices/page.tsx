import Link from "next/link";
import { serverEnv } from "@invoxai/config";
import { issueSubscriptionInvoices, listInvoices } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";

export const dynamic = "force-dynamic";

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export default async function InvoicesPage() {
  const { tenant } = await requireTenant();
  const env = serverEnv();

  // Lazily issue any missing subscription invoices, then list.
  await issueSubscriptionInvoices(tenant.id, env.INVOICE_GST_RATE_BPS);
  const invoices = await listInvoices(tenant.id);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-neutral-400">
        InvoxAI · invoices
      </p>
      <h1 className="mt-1 text-3xl font-bold">Tax invoices</h1>
      <p className="mt-2 text-neutral-500">
        Invoices for what you’ve paid InvoxAI (subscriptions). AI-page and
        commission invoices will appear here as they roll out.
      </p>
      {!env.INVOICE_GSTIN ? (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          These are provisional — InvoxAI’s GSTIN isn’t configured yet, so they
          show as DRAFT (not valid tax invoices).
        </p>
      ) : null}

      {invoices.length === 0 ? (
        <p className="mt-8 text-neutral-500">No invoices yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">For</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/invoices/${inv.id}`} className="font-medium text-blue-600 underline">
                      {inv.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{fmtDate(inv.issuedAt)}</td>
                  <td className="px-4 py-3 text-neutral-600">{inv.descriptionLine}</td>
                  <td className="px-4 py-3 text-right">{formatRupees(inv.totalPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
