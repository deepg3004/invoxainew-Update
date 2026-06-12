import { GlassCard, StatCard } from "@invoxai/ui";
import { getAnalytics } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";

export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90] as const;

function rangeCls(active: boolean): string {
  return `rounded-full px-3 py-1 text-xs font-medium ${
    active ? "bg-brand text-white" : "border border-zinc-200 text-muted hover:bg-zinc-50"
  }`;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { tenant } = await requireTenant();
  const { days: rawDays } = await searchParams;
  const days = RANGES.includes(Number(rawDays) as (typeof RANGES)[number])
    ? (Number(rawDays) as (typeof RANGES)[number])
    : 30;

  const a = await getAnalytics(tenant.id, days);
  const maxRev = Math.max(1, ...a.daily.map((d) => d.revenuePaise));

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted">
            InvoxAI · marketing
          </p>
          <h1 className="mt-1 text-3xl font-bold">Analytics</h1>
          <p className="mt-2 text-muted">Your sales, conversion and leads over time.</p>
        </div>
        <div className="flex items-center gap-2">
          {RANGES.map((r) => (
            <a key={r} href={`/analytics?days=${r}`} className={rangeCls(r === days)}>
              {r}d
            </a>
          ))}
          <a
            href="/utm"
            className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-cyan hover:bg-zinc-50"
          >
            UTM builder
          </a>
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue" value={formatRupees(a.revenuePaise)} hint={`last ${days} days`} />
        <StatCard label="Paid orders" value={a.paidOrders} />
        <StatCard label="Avg order" value={formatRupees(a.aovPaise)} />
        <StatCard label="New leads" value={a.leadCount} />
      </div>

      {/* Revenue chart */}
      <GlassCard className="mt-6">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg font-semibold">Revenue</h2>
          <span className="text-sm text-muted">{formatRupees(a.revenuePaise)} total</span>
        </div>
        {a.revenuePaise === 0 ? (
          <p className="mt-6 text-sm text-muted">No sales in this window yet.</p>
        ) : (
          <div className="mt-6 flex h-40 items-end gap-[3px]">
            {a.daily.map((d) => (
              <div
                key={d.date}
                title={`${d.date}: ${formatRupees(d.revenuePaise)} · ${d.orders} order${d.orders === 1 ? "" : "s"}`}
                className="flex-1 rounded-t bg-brand-gradient transition hover:opacity-80"
                style={{ height: `${Math.max(2, (d.revenuePaise / maxRev) * 100)}%` }}
              />
            ))}
          </div>
        )}
        <div className="mt-2 flex justify-between text-xs text-muted">
          <span>{a.daily[0]?.date}</span>
          <span>{a.daily[a.daily.length - 1]?.date}</span>
        </div>
      </GlassCard>

      {/* Funnel + top items + sources */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <GlassCard>
          <h2 className="font-display text-lg font-semibold">Checkout funnel</h2>
          <div className="mt-4 space-y-3">
            <FunnelRow label="Checkouts started" value={a.startedCheckouts} pct={100} />
            <FunnelRow
              label="Completed (paid)"
              value={a.paidOrders}
              pct={a.startedCheckouts ? (a.paidOrders / a.startedCheckouts) * 100 : 0}
            />
          </div>
          <p className="mt-4 text-sm text-muted">
            Conversion:{" "}
            <span className="font-semibold text-zinc-900">
              {(a.conversionRate * 100).toFixed(1)}%
            </span>
            {a.startedCheckouts - a.paidOrders > 0 ? (
              <>
                {" "}
                ·{" "}
                <a href="/abandoned" className="text-cyan underline">
                  {a.startedCheckouts - a.paidOrders} abandoned
                </a>
              </>
            ) : null}
          </p>
        </GlassCard>

        <GlassCard>
          <h2 className="font-display text-lg font-semibold">Top sellers</h2>
          {a.topItems.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No sales yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {a.topItems.map((it) => (
                <li key={it.title} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-zinc-900">{it.title}</span>
                  <span className="shrink-0 text-muted">
                    {formatRupees(it.revenuePaise)} · {it.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        <GlassCard>
          <h2 className="font-display text-lg font-semibold">Top sources</h2>
          {a.topSources.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No sales yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {a.topSources.map((s) => (
                <li key={s.source} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-zinc-900">{s.source}</span>
                  <span className="shrink-0 text-muted">
                    {formatRupees(s.revenuePaise)} · {s.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">
            Tag your links with{" "}
            <a href="/utm" className="text-cyan underline">
              UTM
            </a>{" "}
            to see which campaigns convert.
          </p>
        </GlassCard>
      </div>
    </div>
  );
}

function FunnelRow({ label, value, pct }: { label: string; value: number; pct: number }) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="font-medium text-zinc-900">{value}</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
        <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
    </div>
  );
}
