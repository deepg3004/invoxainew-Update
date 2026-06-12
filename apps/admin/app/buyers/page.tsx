import {formatDateIST} from "@invoxai/utils/date";
import Link from "next/link";
import { Button, GlassCard, PageHeader } from "@invoxai/ui";
import { searchBuyerPayments } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireAdmin } from "../../lib/auth";
import { AdminShell } from "../components/AdminShell";
import { NotAuthorized } from "../components/NotAuthorized";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return formatDateIST(d);
}

export default async function BuyersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const gate = await requireAdmin();
  if (!gate.ok) return <NotAuthorized email={gate.user.email} />;

  const { q } = await searchParams;
  const results = q ? await searchBuyerPayments(q) : [];

  return (
    <AdminShell email={gate.user.email}>
      <PageHeader
        eyebrow="InvoxAI · admin"
        title="Buyer lookup"
        description="Find a buyer’s payments across all sellers by email or phone (support)."
        actions={
          <form method="get" className="flex gap-2">
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="buyer email or phone"
              className="w-full max-w-md rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand"
            />
            <Button type="submit" size="sm">
              Search
            </Button>
          </form>
        }
      />

      {!q ? (
        <GlassCard>
          <p className="text-sm text-muted">Enter an email or phone to search.</p>
        </GlassCard>
      ) : results.length === 0 ? (
        <GlassCard>
          <p className="text-sm text-muted">No payments found for “{q}”.</p>
        </GlassCard>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Buyer</th>
                <th className="px-4 py-3 font-medium">Seller</th>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                  <td className="px-4 py-3 text-muted">{fmtDate(r.paidAt ?? r.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div>{r.buyerEmail ?? "—"}</div>
                    {r.buyerContact ? <div className="text-xs text-muted">{r.buyerContact}</div> : null}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/tenants/${r.tenant.id}`} className="text-brand-strong underline">
                      {r.tenant.username}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{r.itemTitle ?? r.paymentPage?.title ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted">{r.status}</span>
                    {r.status === "PAID" ? (
                      <span className="ml-1 text-xs text-muted">· {r.fulfillmentStatus}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right">{formatRupees(r.amountPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
