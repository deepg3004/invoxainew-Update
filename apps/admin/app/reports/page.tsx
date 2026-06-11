import Link from "next/link";
import { Card } from "@invoxai/ui";
import {
  getRevenueReport,
  getWalletAttention,
  listRecentPaymentEvents,
} from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireAdmin } from "../../lib/auth";
import { AdminShell } from "../components/AdminShell";
import { NotAuthorized } from "../components/NotAuthorized";

export const dynamic = "force-dynamic";

function fmtDateTime(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function ReportsPage() {
  const gate = await requireAdmin();
  if (!gate.ok) return <NotAuthorized email={gate.user.email} />;

  const [rev, attention, events] = await Promise.all([
    getRevenueReport(),
    getWalletAttention(),
    listRecentPaymentEvents(),
  ]);

  return (
    <AdminShell email={gate.user.email}>
      <h1 className="text-2xl font-bold">Reports</h1>

      <h2 className="mt-6 text-lg font-bold">InvoxAI revenue</h2>
      <p className="text-sm text-neutral-500">
        InvoxAI’s own income only — buyer payments settle to sellers and are never
        counted here.
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Total earned">
          <p className="text-2xl font-bold">{formatRupees(rev.totalEarnedPaise)}</p>
          <p className="mt-1 text-xs text-neutral-400">commission + AI pages + subs</p>
        </Card>
        <Card title="Commission">
          <p className="text-2xl font-bold">{formatRupees(rev.commissionCollectedPaise)}</p>
          <p className="mt-1 text-xs text-amber-600">
            {rev.commissionDuePaise > 0 ? `${formatRupees(rev.commissionDuePaise)} due` : "all collected"}
          </p>
        </Card>
        <Card title="AI page fees">
          <p className="text-2xl font-bold">{formatRupees(rev.aiPageFeesPaise)}</p>
          <p className="mt-1 text-xs text-neutral-400">{rev.aiPageCount} pages</p>
        </Card>
        <Card title="Subscriptions">
          <p className="text-2xl font-bold">{formatRupees(rev.subscriptionRevenuePaise)}</p>
          <p className="mt-1 text-xs text-neutral-400">{rev.subscriptionCount} payments</p>
        </Card>
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Card title="Wallet top-ups received">
          <p className="text-xl font-bold">{formatRupees(rev.walletTopupsPaise)}</p>
        </Card>
        <Card title="Wallet liability (held seller funds)">
          <p className="text-xl font-bold">{formatRupees(rev.walletLiabilityPaise)}</p>
          <p className="mt-1 text-xs text-neutral-400">Prepaid balances InvoxAI holds</p>
        </Card>
      </div>

      <h2 className="mt-8 text-lg font-bold">Needs attention</h2>
      <p className="text-sm text-neutral-500">
        Sellers with outstanding commission or a low wallet (commission pauses /
        AI pages blocked until topped up).
      </p>
      {attention.length === 0 ? (
        <p className="mt-2 text-sm text-green-700">All sellers healthy ✓</p>
      ) : (
        <div className="mt-2 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">Tenant</th>
                <th className="px-4 py-2 font-medium text-right">Wallet</th>
                <th className="px-4 py-2 font-medium text-right">Commission due</th>
              </tr>
            </thead>
            <tbody>
              {attention.map((a) => (
                <tr key={a.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2">
                    <Link href={`/tenants/${a.id}`} className="text-blue-600 underline">
                      {a.username}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right">{formatRupees(a.balancePaise)}</td>
                  <td className={`px-4 py-2 text-right ${a.commissionDuePaise > 0 ? "font-medium text-amber-600" : "text-neutral-400"}`}>
                    {a.commissionDuePaise > 0 ? formatRupees(a.commissionDuePaise) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-8 text-lg font-bold">Recent webhook events</h2>
      <p className="text-sm text-neutral-500">
        Accepted Razorpay events (signature-verified). Failed/unsigned deliveries
        are rejected at the edge and not stored.
      </p>
      {events.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-400">No events yet.</p>
      ) : (
        <div className="mt-2 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2 text-neutral-500">{fmtDateTime(e.createdAt)}</td>
                  <td className="px-4 py-2 font-medium">{e.type}</td>
                  <td className="px-4 py-2">
                    {e.processedAt ? (
                      <span className="text-xs text-green-700">processed</span>
                    ) : (
                      <span className="text-xs font-medium text-red-700">
                        UNPROCESSED{e.attempts > 1 ? ` (${e.attempts} tries)` : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right text-xs text-neutral-400">{e.eventId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
