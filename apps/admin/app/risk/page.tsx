import { formatDateTimeShortIST } from "@invoxai/utils/date";
import Link from "next/link";
import { GlassCard, PageHeader } from "@invoxai/ui";
import { refreshRiskAlerts, listRiskAlerts } from "@invoxai/db";
import { requireAdmin } from "../../lib/auth";
import { AdminShell } from "../components/AdminShell";
import { NotAuthorized } from "../components/NotAuthorized";
import { dismissRiskAlertAction } from "./actions";

export const dynamic = "force-dynamic";

const TABS = ["OPEN", "DISMISSED", "RESOLVED"] as const;
type Tab = (typeof TABS)[number];

const TYPE_LABEL: Record<string, string> = {
  chargebacks: "Chargebacks",
  abuse_reports: "Abuse reports",
  commission_due: "Uncollected commission",
};

const SEV_STYLE: Record<string, string> = {
  HIGH: "bg-red-50 text-red-700",
  MEDIUM: "bg-amber-50 text-amber-700",
  LOW: "bg-zinc-100 text-zinc-600",
};

function tabCls(active: boolean): string {
  return `rounded-full px-3 py-1 text-xs font-medium ${
    active ? "bg-brand text-white" : "border border-zinc-200 text-muted hover:bg-zinc-50"
  }`;
}

export default async function RiskPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const gate = await requireAdmin();
  if (!gate.ok) return <NotAuthorized email={gate.user.email} />;

  // Recompute on view so the queue reflects current data (idempotent).
  await refreshRiskAlerts();

  const { status: raw } = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(raw ?? "") ? (raw as Tab) : "OPEN";
  const alerts = await listRiskAlerts(tab);

  return (
    <AdminShell email={gate.user.email}>
      <PageHeader
        eyebrow="InvoxAI · admin · safety"
        title="Risk alerts"
        description="Auto-detected risk signals from chargebacks, abuse reports and uncollected commission. Open a seller to suspend or act."
        actions={
          <>
            {TABS.map((t) => (
              <Link key={t} href={`/risk?status=${t}`} className={tabCls(t === tab)}>
                {t.charAt(0) + t.slice(1).toLowerCase()}
              </Link>
            ))}
          </>
        }
      />

      {alerts.length === 0 ? (
        <GlassCard className="mt-6">
          <p className="text-sm text-emerald-700">No {tab.toLowerCase()} risk alerts ✓</p>
        </GlassCard>
      ) : (
        <div className="mt-6 space-y-3">
          {alerts.map((a) => (
            <GlassCard key={a.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/tenants/${a.tenant.id}`}
                    className="font-semibold text-brand-strong hover:underline"
                  >
                    {a.tenant.name?.trim() || a.tenant.username}
                  </Link>
                  {a.tenant.suspendedAt ? (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                      Suspended
                    </span>
                  ) : null}
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                    {TYPE_LABEL[a.type] ?? a.type}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      SEV_STYLE[a.severity] ?? "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {a.severity}
                  </span>
                </div>
                <span className="text-xs text-muted">{formatDateTimeShortIST(a.updatedAt)}</span>
              </div>
              <p className="mt-2 text-sm text-zinc-700">{a.detail}</p>
              {a.reviewedBy ? (
                <p className="mt-1 text-xs text-muted">Dismissed by {a.reviewedBy}</p>
              ) : null}
              {a.status === "OPEN" ? (
                <form action={dismissRiskAlertAction.bind(null, a.id)} className="mt-3">
                  <button className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                    Dismiss
                  </button>
                </form>
              ) : null}
            </GlassCard>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
