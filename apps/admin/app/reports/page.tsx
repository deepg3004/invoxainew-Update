import {formatDateTimeShortIST} from "@invoxai/utils/date";
import Link from "next/link";
import { GlassCard, PageHeader, StatCard } from "@invoxai/ui";
import {
  getRevenueReport,
  getWalletAttention,
  listRecentPaymentEvents,
} from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireAdmin } from "../../lib/auth";
import { AdminShell } from "../components/AdminShell";
import { NotAuthorized } from "../components/NotAuthorized";
import { RevenueBreakdownChart } from "../components/RevenueBreakdownChart";

export const dynamic = "force-dynamic";

function fmtDateTime(d: Date): string {
  return formatDateTimeShortIST(d);
}

const RANGES = [
  { key: "7", label: "7d", days: 7 },
  { key: "30", label: "30d", days: 30 },
  { key: "90", label: "90d", days: 90 },
  { key: "all", label: "All time", days: undefined },
] as const;

function rangeCls(active: boolean): string {
  return `rounded-full px-3 py-1 text-xs font-medium ${
    active ? "bg-brand text-white" : "border border-zinc-200 text-muted hover:bg-zinc-50"
  }`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const gate = await requireAdmin();
  if (!gate.ok) return <NotAuthorized email={gate.user.email} />;

  const { range: rawRange } = await searchParams;
  const range = RANGES.find((r) => r.key === rawRange) ?? RANGES[3]; // default All time

  const [rev, attention, events] = await Promise.all([
    getRevenueReport(range.days),
    getWalletAttention(),
    listRecentPaymentEvents(),
  ]);

  return (
    <AdminShell email={gate.user.email}>
      <PageHeader
        eyebrow="InvoxAI · admin"
        title="Reports"
        actions={
          <div className="flex items-center gap-2">
            {RANGES.map((r) => (
              <a key={r.key} href={`/reports?range=${r.key}`} className={rangeCls(r.key === range.key)}>
                {r.label}
              </a>
            ))}
          </div>
        }
      />

      <h2 className="mt-8 text-lg font-semibold text-zinc-900">
        InvoxAI revenue {range.days ? `· last ${range.days} days` : "· all time"}
      </h2>
      <p className="mt-1 text-sm text-muted">
        InvoxAI’s own income only — buyer payments settle to sellers and are never
        counted here. Wallet liability below is the current held balance (not windowed).
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total earned"
          value={formatRupees(rev.totalEarnedPaise)}
          hint="commission + AI pages + subs"
        />
        <StatCard
          label="Commission"
          value={formatRupees(rev.commissionCollectedPaise)}
          accent="warning"
          hint={
            rev.commissionDuePaise > 0
              ? `${formatRupees(rev.commissionDuePaise)} due`
              : "all collected"
          }
        />
        <StatCard
          label="AI page fees"
          value={formatRupees(rev.aiPageFeesPaise)}
          hint={`${rev.aiPageCount} pages`}
        />
        <StatCard
          label="Subscriptions"
          value={formatRupees(rev.subscriptionRevenuePaise)}
          hint={`${rev.subscriptionCount} payments`}
        />
      </div>

      <GlassCard className="mt-4" title="Revenue mix">
        <RevenueBreakdownChart
          data={[
            { name: "Commission", value: Math.round(rev.commissionCollectedPaise / 100) },
            { name: "AI pages", value: Math.round(rev.aiPageFeesPaise / 100) },
            { name: "Subscriptions", value: Math.round(rev.subscriptionRevenuePaise / 100) },
          ]}
        />
      </GlassCard>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Wallet top-ups received"
          value={formatRupees(rev.walletTopupsPaise)}
        />
        <StatCard
          label="Wallet liability (held seller funds)"
          value={formatRupees(rev.walletLiabilityPaise)}
          hint="Prepaid balances InvoxAI holds"
        />
      </div>

      <h2 className="mt-8 text-lg font-semibold text-zinc-900">Needs attention</h2>
      <p className="mt-1 text-sm text-muted">
        Sellers with outstanding commission or a low wallet (commission pauses /
        AI pages blocked until topped up).
      </p>
      {attention.length === 0 ? (
        <p className="mt-2 text-sm text-green-700">All sellers healthy ✓</p>
      ) : (
        <GlassCard className="mt-3 overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Tenant</th>
                <th className="px-4 py-3 font-medium text-right">Wallet</th>
                <th className="px-4 py-3 font-medium text-right">Commission due</th>
              </tr>
            </thead>
            <tbody>
              {attention.map((a) => (
                <tr key={a.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <Link href={`/tenants/${a.id}`} className="text-brand-strong underline">
                      {a.username}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right">{formatRupees(a.balancePaise)}</td>
                  <td className={`px-4 py-3 text-right ${a.commissionDuePaise > 0 ? "font-medium text-warning" : "text-muted"}`}>
                    {a.commissionDuePaise > 0 ? formatRupees(a.commissionDuePaise) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      )}

      <h2 className="mt-8 text-lg font-semibold text-zinc-900">Recent webhook events</h2>
      <p className="mt-1 text-sm text-muted">
        Accepted Razorpay events (signature-verified). Failed/unsigned deliveries
        are rejected at the edge and not stored.
      </p>
      {events.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No events yet.</p>
      ) : (
        <GlassCard className="mt-3 overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t border-zinc-100 first:border-0 hover:bg-zinc-50">
                  <td className="px-4 py-3 text-muted">{fmtDateTime(e.createdAt)}</td>
                  <td className="px-4 py-3 font-medium">{e.type}</td>
                  <td className="px-4 py-3">
                    {e.processedAt ? (
                      <span className="text-xs text-green-700">processed</span>
                    ) : (
                      <span className="text-xs font-medium text-red-700">
                        UNPROCESSED{e.attempts > 1 ? ` (${e.attempts} tries)` : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted">{e.eventId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      )}
    </AdminShell>
  );
}
