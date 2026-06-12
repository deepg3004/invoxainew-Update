import {formatDateIST} from "@invoxai/utils/date";
import Link from "next/link";
import { issuePlatformInvoices, listInvoices } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { GST_STATES, gstStateName } from "@invoxai/utils/states";
import { Button, GlassCard, PageHeader } from "@invoxai/ui";
import { requireTenant } from "../../lib/tenant";
import { getInvoiceConfig } from "../../lib/invoice-config";
import { saveTenantStateAction } from "./actions";

export const dynamic = "force-dynamic";

function fmtDate(d: Date): string {
  return formatDateIST(d);
}

export default async function InvoicesPage() {
  const { tenant } = await requireTenant();
  const cfg = await getInvoiceConfig();

  // Lazily issue any missing platform invoices (subscriptions + wallet recharges),
  // then list. Uses the admin-managed GST rate + number prefix (env fallback).
  await issuePlatformInvoices(tenant.id, cfg.gstRateBps, cfg.numberPrefix);
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
      {!cfg.gstin ? (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          These are provisional — InvoxAI’s GSTIN isn’t configured yet, so they
          show as DRAFT (not valid tax invoices).
        </p>
      ) : null}

      <GlassCard className="mt-6" title="Your tax details">
        <p className="text-sm text-muted">
          Your state sets the “place of supply” on these invoices and whether GST shows as
          IGST (interstate) or CGST + SGST (same state).
        </p>
        <form action={saveTenantStateAction} className="mt-3 flex flex-wrap items-center gap-2">
          <select
            name="stateCode"
            defaultValue={tenant.stateCode ?? ""}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand"
          >
            <option value="">Select your state</option>
            {GST_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
          <button className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">Save</button>
          {tenant.stateCode ? (
            <span className="text-sm text-muted">Current: {gstStateName(tenant.stateCode)}</span>
          ) : null}
        </form>
      </GlassCard>

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
