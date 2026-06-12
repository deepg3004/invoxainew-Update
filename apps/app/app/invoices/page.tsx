import {formatDateIST} from "@invoxai/utils/date";
import Link from "next/link";
import { serverEnv } from "@invoxai/config";
import { issuePlatformInvoices, listInvoices } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { Button, GlassCard, PageHeader } from "@invoxai/ui";
import { requireTenant } from "../../lib/tenant";

export const dynamic = "force-dynamic";

function fmtDate(d: Date): string {
  return formatDateIST(d);
}

export default async function InvoicesPage() {
  const { tenant } = await requireTenant();
  const env = serverEnv();

  // Lazily issue any missing platform invoices (subscriptions + wallet recharges),
  // then list.
  await issuePlatformInvoices(tenant.id, env.INVOICE_GST_RATE_BPS);
  const invoices = await listInvoices(tenant.id);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · invoices"
        title="Tax invoices"
        description="Invoices for what you’ve paid InvoxAI — subscriptions and wallet recharges. AI-page and commission invoices will appear here as they roll out."
        actions={
          <Button href="/invoices/export" variant="secondary" size="sm">
            Export CSV
          </Button>
        }
      />
      {!env.INVOICE_GSTIN ? (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          These are provisional — InvoxAI’s GSTIN isn’t configured yet, so they
          show as DRAFT (not valid tax invoices).
        </p>
      ) : null}

      {invoices.length === 0 ? (
        <GlassCard className="mt-6">
          <p className="text-sm text-muted">No invoices yet.</p>
        </GlassCard>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">For</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <Link href={`/invoices/${inv.id}`} className="font-medium text-brand-strong underline">
                      {inv.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{fmtDate(inv.issuedAt)}</td>
                  <td className="px-4 py-3 text-muted">{inv.descriptionLine}</td>
                  <td className="px-4 py-3 text-right">{formatRupees(inv.totalPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
