import { formatDateTimeShortIST } from "@invoxai/utils/date";
import Link from "next/link";
import { GlassCard, PageHeader } from "@invoxai/ui";
import { getWalletAttention, listRecentPaymentEvents, listAbuseReports } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireAdmin } from "../../lib/auth";
import { AdminShell } from "../components/AdminShell";
import { NotAuthorized } from "../components/NotAuthorized";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  const gate = await requireAdmin();
  if (!gate.ok) return <NotAuthorized email={gate.user.email} />;

  const [attention, events, openAbuse] = await Promise.all([
    getWalletAttention(),
    listRecentPaymentEvents(),
    listAbuseReports({ status: "NEW", take: 10 }),
  ]);
  const unprocessed = events.filter((e) => !e.processedAt);

  return (
    <AdminShell email={gate.user.email}>
      <PageHeader
        eyebrow="InvoxAI · admin"
        title="Notifications"
        description="Platform alerts derived from live data — sellers needing attention and webhook delivery issues."
      />

      <GlassCard title={`Sellers needing attention (${attention.length})`}>
        {attention.length === 0 ? (
          <p className="text-sm text-emerald-700">All sellers healthy ✓</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {attention.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <Link href={`/tenants/${a.id}`} className="font-medium text-brand-strong hover:underline">
                  {a.username}
                </Link>
                <span className="text-muted">
                  wallet {formatRupees(a.balancePaise)}
                  {a.commissionDuePaise > 0 ? ` · ${formatRupees(a.commissionDuePaise)} due` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      <GlassCard className="mt-4" title={`Open abuse reports (${openAbuse.length})`}>
        {openAbuse.length === 0 ? (
          <p className="text-sm text-emerald-700">No open reports ✓</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {openAbuse.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <Link href="/abuse-reports" className="font-medium text-brand-strong hover:underline">
                  {r.tenant.name?.trim() || r.tenant.username}
                </Link>
                <span className="text-xs font-medium text-red-700">
                  {r.reason} · {formatDateTimeShortIST(r.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      <GlassCard className="mt-4" title={`Unprocessed webhooks (${unprocessed.length})`}>
        {unprocessed.length === 0 ? (
          <p className="text-sm text-emerald-700">All recent webhooks processed ✓</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {unprocessed.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="font-medium text-zinc-900">{e.type}</span>
                <span className="text-xs font-medium text-red-700">
                  UNPROCESSED{e.attempts > 1 ? ` (${e.attempts} tries)` : ""} ·{" "}
                  {formatDateTimeShortIST(e.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </AdminShell>
  );
}
