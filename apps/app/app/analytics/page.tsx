import { Button, GlassCard, PageHeader, StatCard } from "@invoxai/ui";
import {
  getAnalytics,
  getTrafficAnalytics,
  getCourseAnalytics,
  getStoreAnalytics,
} from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";
import { RevenueChart } from "../components/RevenueChart";
import { TrafficChart } from "../components/TrafficChart";

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

  const [a, traffic, courseStats, storeStats] = await Promise.all([
    getAnalytics(tenant.id, days),
    getTrafficAnalytics(tenant.id, days),
    getCourseAnalytics(tenant.id),
    getStoreAnalytics(tenant.id),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · marketing"
        title="Analytics"
        description="Your sales, conversion and leads over time."
        actions={
          <>
            {RANGES.map((r) => (
              <a key={r} href={`/analytics?days=${r}`} className={rangeCls(r === days)}>
                {r}d
              </a>
            ))}
            <a
              href="/utm"
              className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-brand-strong hover:bg-zinc-50"
            >
              UTM builder
            </a>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue" value={formatRupees(a.revenuePaise)} hint={`last ${days} days`} />
        <StatCard label="Paid orders" value={a.paidOrders} />
        <StatCard label="Avg order" value={formatRupees(a.aovPaise)} />
        <StatCard label="New leads" value={a.leadCount} />
      </div>

      {/* Revenue chart */}
      <GlassCard className="mt-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Revenue</h2>
          <span className="text-sm text-muted">{formatRupees(a.revenuePaise)} total</span>
        </div>
        {a.revenuePaise === 0 ? (
          <p className="mt-6 text-sm text-muted">No sales in this window yet.</p>
        ) : (
          <div className="mt-4">
            <RevenueChart
              data={a.daily.map((d) => ({
                date: d.date.slice(5),
                revenue: Math.round(d.revenuePaise / 100),
                orders: d.orders,
              }))}
            />
          </div>
        )}
      </GlassCard>

      {/* Traffic (page-level analytics) */}
      <GlassCard className="mt-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Traffic</h2>
          <span className="text-sm text-muted">
            {traffic.views} view{traffic.views === 1 ? "" : "s"} · {traffic.sessions} session
            {traffic.sessions === 1 ? "" : "s"}
          </span>
        </div>
        {traffic.views === 0 ? (
          <p className="mt-6 text-sm text-muted">
            No page views yet. Views start counting as visitors land on your public pages
            (store, product, payment and AI pages).
          </p>
        ) : (
          <>
            <div className="mt-4">
              <TrafficChart data={traffic.daily} />
            </div>
            <h3 className="mt-6 text-sm font-semibold text-zinc-900">Top pages</h3>
            <ul className="mt-2 divide-y divide-zinc-100">
              {traffic.topPaths.map((p) => (
                <li key={p.path} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate font-mono text-zinc-700">{p.path}</span>
                  <span className="shrink-0 text-muted">{p.views}</span>
                </li>
              ))}
            </ul>

            {traffic.topReferrers.length > 0 || traffic.topCampaigns.length > 0 ? (
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">Top referrers</h3>
                  {traffic.topReferrers.length === 0 ? (
                    <p className="mt-2 text-sm text-muted">All direct so far.</p>
                  ) : (
                    <ul className="mt-2 divide-y divide-zinc-100">
                      {traffic.topReferrers.map((r) => (
                        <li key={r.source} className="flex items-center justify-between gap-3 py-2 text-sm">
                          <span className="min-w-0 truncate text-zinc-700">{r.source}</span>
                          <span className="shrink-0 text-muted">{r.views}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">Top campaigns</h3>
                  {traffic.topCampaigns.length === 0 ? (
                    <p className="mt-2 text-sm text-muted">
                      Tag links with{" "}
                      <a href="/utm" className="text-brand-strong underline">UTM</a> to track campaigns.
                    </p>
                  ) : (
                    <ul className="mt-2 divide-y divide-zinc-100">
                      {traffic.topCampaigns.map((c) => (
                        <li key={c.source} className="flex items-center justify-between gap-3 py-2 text-sm">
                          <span className="min-w-0 truncate text-zinc-700">{c.source}</span>
                          <span className="shrink-0 text-muted">{c.views}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : null}
          </>
        )}
      </GlassCard>

      {/* Funnel + top items + sources */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <GlassCard>
          <h2 className="text-lg font-semibold text-zinc-900">Checkout funnel</h2>
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
                <a href="/abandoned" className="text-brand-strong underline">
                  {a.startedCheckouts - a.paidOrders} abandoned
                </a>
              </>
            ) : null}
          </p>
        </GlassCard>

        <GlassCard>
          <h2 className="text-lg font-semibold text-zinc-900">Top sellers</h2>
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
          <h2 className="text-lg font-semibold text-zinc-900">Top sources</h2>
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
            <a href="/utm" className="text-brand-strong underline">
              UTM
            </a>{" "}
            to see which campaigns convert.
          </p>
        </GlassCard>
      </div>

      {/* Store + Course breakouts */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <GlassCard>
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">Store</h2>
            <span className="text-sm text-muted">
              {storeStats.totalUnits} sold · {storeStats.publishedCount} live
            </span>
          </div>
          {storeStats.products.filter((p) => p.units > 0).length === 0 ? (
            <p className="mt-4 text-sm text-muted">No product sales yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {storeStats.products
                .filter((p) => p.units > 0)
                .slice(0, 8)
                .map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-zinc-900">{p.title}</span>
                    <span className="shrink-0 text-muted">
                      {p.units} sold
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </GlassCard>

        <GlassCard>
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">Courses</h2>
            <span className="text-sm text-muted">
              {formatRupees(courseStats.totalRevenuePaise)} · {courseStats.totalEnrolments} enrolled
            </span>
          </div>
          {courseStats.courses.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No courses yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {courseStats.courses.slice(0, 8).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-zinc-900">{c.title}</span>
                  <span className="shrink-0 text-muted">
                    {formatRupees(c.revenuePaise)} · {c.enrolments} enrolled
                  </span>
                </li>
              ))}
            </ul>
          )}
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
