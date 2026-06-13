import { formatDateTimeShortIST } from "@invoxai/utils/date";
import Link from "next/link";
import { GlassCard, PageHeader, Pagination, pageSlice } from "@invoxai/ui";
import { listAbuseReports, countAbuseReports } from "@invoxai/db";
import { requireAdmin } from "../../lib/auth";
import { AdminShell } from "../components/AdminShell";
import { NotAuthorized } from "../components/NotAuthorized";
import { reviewAbuseReportAction } from "./actions";

export const dynamic = "force-dynamic";

const TABS = ["NEW", "REVIEWING", "ACTIONED", "DISMISSED", "ALL"] as const;
type Tab = (typeof TABS)[number];

const REASON_LABEL: Record<string, string> = {
  fraud: "Scam / fraud",
  prohibited: "Prohibited goods",
  offensive: "Offensive content",
  spam: "Spam / misleading",
  other: "Other",
};

const STATUS_STYLE: Record<string, string> = {
  NEW: "bg-red-50 text-red-700",
  REVIEWING: "bg-amber-50 text-amber-700",
  ACTIONED: "bg-emerald-50 text-emerald-700",
  DISMISSED: "bg-zinc-100 text-zinc-600",
};

function tabCls(active: boolean): string {
  return `rounded-full px-3 py-1 text-xs font-medium ${
    active ? "bg-brand text-white" : "border border-zinc-200 text-muted hover:bg-zinc-50"
  }`;
}

export default async function AbuseReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; size?: string }>;
}) {
  const gate = await requireAdmin();
  if (!gate.ok) return <NotAuthorized email={gate.user.email} />;

  const { status: raw, page: rawPage, size: rawSize } = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(raw ?? "") ? (raw as Tab) : "NEW";
  const statusFilter = tab === "ALL" ? undefined : (tab as Exclude<Tab, "ALL">);
  const total = await countAbuseReports(statusFilter);
  const { page, totalPages, skip, take, pageSize } = pageSlice(total, rawPage, rawSize);
  const reports = await listAbuseReports({ status: statusFilter, skip, take });
  const firstOnPage = total === 0 ? 0 : skip + 1;
  const lastOnPage = skip + reports.length;

  return (
    <AdminShell email={gate.user.email}>
      <PageHeader
        eyebrow="InvoxAI · admin · safety"
        title="Abuse reports"
        description="Reports filed from storefronts. Triage them, then suspend the seller or disable content from the seller's page if needed."
        actions={
          <>
            {TABS.map((t) => (
              <Link key={t} href={`/abuse-reports?status=${t}`} className={tabCls(t === tab)}>
                {t === "ALL" ? "All" : t.charAt(0) + t.slice(1).toLowerCase()}
              </Link>
            ))}
          </>
        }
      />

      {reports.length === 0 ? (
        <GlassCard className="mt-6">
          <p className="text-sm text-emerald-700">Nothing here ✓</p>
        </GlassCard>
      ) : (
        <div className="mt-6 space-y-4">
          {reports.map((r) => (
            <GlassCard key={r.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/tenants/${r.tenant.id}`}
                    className="font-semibold text-brand-strong hover:underline"
                  >
                    {r.tenant.name?.trim() || r.tenant.username}
                  </Link>
                  {r.tenant.suspendedAt ? (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                      Suspended
                    </span>
                  ) : null}
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                    {REASON_LABEL[r.reason] ?? r.reason}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_STYLE[r.status] ?? "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
                <span className="text-xs text-muted">{formatDateTimeShortIST(r.createdAt)}</span>
              </div>

              {r.detail ? (
                <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-700">{r.detail}</p>
              ) : (
                <p className="mt-3 text-sm italic text-muted">No details provided.</p>
              )}
              <p className="mt-2 text-xs text-muted">
                Reporter: {r.reporterEmail ?? "anonymous"}
                {r.reviewedBy ? ` · last reviewed by ${r.reviewedBy}` : ""}
                {r.adminNote ? ` · note: ${r.adminNote}` : ""}
              </p>

              <form action={reviewAbuseReportAction} className="mt-4 flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={r.id} />
                <label className="text-sm">
                  <span className="mr-2 text-muted">Status</span>
                  <select
                    name="status"
                    defaultValue={r.status}
                    className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                  >
                    <option value="NEW">New</option>
                    <option value="REVIEWING">Reviewing</option>
                    <option value="ACTIONED">Actioned</option>
                    <option value="DISMISSED">Dismissed</option>
                  </select>
                </label>
                <input
                  name="note"
                  placeholder="Add a note (optional)"
                  maxLength={1000}
                  className="min-w-[200px] flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm"
                />
                <button className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">
                  Save
                </button>
              </form>
            </GlassCard>
          ))}
        </div>
      )}
      {total > 0 ? (
        <Pagination
          page={page}
          totalPages={totalPages}
          firstOnPage={firstOnPage}
          lastOnPage={lastOnPage}
          total={total}
          pageSize={pageSize}
          label="reports"
        />
      ) : null}
    </AdminShell>
  );
}
