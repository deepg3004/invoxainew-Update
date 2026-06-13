import { formatDateIST } from "@invoxai/utils/date";
import { Button, GlassCard, PageHeader, StatCard } from "@invoxai/ui";
import {
  listTenantOrders,
  countTenantOrders,
  getTenantSalesSummary,
  getAnalytics,
} from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";
import { RevenueChart } from "../components/RevenueChart";

export const dynamic = "force-dynamic";

// 10 rows per page (as requested).
const PAGE_SIZE = 10;

function buildHref(params: { q?: string; page?: number }): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `/transactions?${qs}` : "/transactions";
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { tenant } = await requireTenant();
  const { q: rawQ, page: rawPage } = await searchParams;
  const search = (rawQ ?? "").trim();
  const filter = { search: search || undefined };

  const [total, summary, analytics] = await Promise.all([
    countTenantOrders(tenant.id, filter),
    getTenantSalesSummary(tenant.id),
    getAnalytics(tenant.id, 30),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1), totalPages);
  const rows = await listTenantOrders(tenant.id, {
    ...filter,
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const firstOnPage = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastOnPage = (page - 1) * PAGE_SIZE + rows.length;
  const netPaise = summary.grossPaise - summary.commissionPaidPaise;

  const exportHref = `/orders/export${search ? `?q=${encodeURIComponent(search)}` : ""}`;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · money"
        title="Transactions"
        description="Every sale settled to your gateway, with the InvoxAI commission and your net."
        actions={total > 0 ? <Button href={exportHref} variant="secondary" size="sm">Export CSV</Button> : undefined}
      />

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total earnings" value={formatRupees(summary.grossPaise)} hint="Settled to your gateway" />
        <StatCard
          label="InvoxAI commission"
          value={formatRupees(summary.commissionPaidPaise)}
          hint={
            summary.commissionDuePaise > 0
              ? `${formatRupees(summary.commissionDuePaise)} due (settles on top-up)`
              : "From your wallet"
          }
          accent={summary.commissionDuePaise > 0 ? "warning" : undefined}
        />
        <StatCard label="Net (after commission)" value={formatRupees(netPaise)} />
        <StatCard label="Transactions" value={summary.orderCount} />
      </div>

      {/* Earnings chart */}
      <GlassCard className="mt-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Earnings</h2>
          <span className="text-sm text-muted">last 30 days</span>
        </div>
        {analytics.revenuePaise === 0 ? (
          <p className="mt-6 text-sm text-muted">No sales in the last 30 days yet.</p>
        ) : (
          <div className="mt-4">
            <RevenueChart
              data={analytics.daily.map((d) => ({
                date: d.date.slice(5),
                revenue: Math.round(d.revenuePaise / 100),
                orders: d.orders,
              }))}
            />
          </div>
        )}
      </GlassCard>

      {/* Search */}
      <form method="get" className="mt-8 flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={search}
          placeholder="Search buyer email, phone, item, payment id…"
          className="w-full max-w-xs rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand"
        />
        <Button type="submit" variant="secondary" size="sm">Search</Button>
        {search ? (
          <a href={buildHref({})} className="px-2 py-1.5 text-sm text-muted hover:text-zinc-900">Clear</a>
        ) : null}
      </form>

      {/* Table */}
      {rows.length === 0 ? (
        <GlassCard className="mt-4">
          <p className="text-sm text-muted">
            {search ? `No transactions match “${search}”.` : "No transactions yet."}
          </p>
        </GlassCard>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3 text-right font-medium">Commission</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {o.paidAt ? formatDateIST(o.paidAt) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-zinc-900">{o.buyerEmail ?? "—"}</span>
                      {o.buyerContact ? (
                        <span className="block text-xs text-muted">{o.buyerContact}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-zinc-900">{o.itemTitle ?? o.paymentPage?.title ?? "Order"}</span>
                      {o.paymentMethod === "UPI_MANUAL" ? (
                        <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand-strong">UPI</span>
                      ) : null}
                      {o.couponCode ? (
                        <span className="block text-xs font-medium text-green-700">
                          {o.couponCode}: −{formatRupees(o.discountPaise)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-zinc-900">
                      {formatRupees(o.amountPaise)}
                      {o.refundedPaise > 0 ? (
                        <span className="block text-xs font-medium text-red-700">
                          −{formatRupees(o.refundedPaise)} refunded
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {o.commission ? (
                        <>
                          <span className="text-zinc-700">{formatRupees(o.commission.amountPaise)}</span>
                          {o.commission.status === "DUE" ? (
                            <span className="block text-xs font-medium text-amber-700">due</span>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-between text-sm text-muted">
            <span>Showing {firstOnPage}–{lastOnPage} of {total}</span>
            {totalPages > 1 ? (
              <div className="flex items-center gap-2">
                {page > 1 ? (
                  <a href={buildHref({ q: search, page: page - 1 })} className="rounded-lg border border-zinc-200 px-3 py-1.5 font-medium hover:bg-zinc-50">← Prev</a>
                ) : (
                  <span className="rounded-lg border border-zinc-200 px-3 py-1.5 text-muted/40">← Prev</span>
                )}
                <span>Page {page} of {totalPages}</span>
                {page < totalPages ? (
                  <a href={buildHref({ q: search, page: page + 1 })} className="rounded-lg border border-zinc-200 px-3 py-1.5 font-medium hover:bg-zinc-50">Next →</a>
                ) : (
                  <span className="rounded-lg border border-zinc-200 px-3 py-1.5 text-muted/40">Next →</span>
                )}
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
