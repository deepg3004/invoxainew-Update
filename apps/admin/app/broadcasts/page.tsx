import { formatDateTimeShortIST } from "@invoxai/utils/date";
import { GlassCard, PageHeader, Badge } from "@invoxai/ui";
import { listRecentBroadcasts } from "@invoxai/db";
import { requireAdmin } from "../../lib/auth";
import { AdminShell } from "../components/AdminShell";
import { NotAuthorized } from "../components/NotAuthorized";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "neutral" | "cyan" | "success"> = {
  DRAFT: "neutral",
  QUEUED: "cyan",
  SENDING: "cyan",
  SENT: "success",
  CANCELLED: "neutral",
};

export default async function AdminBroadcastsPage() {
  const gate = await requireAdmin();
  if (!gate.ok) return <NotAuthorized email={gate.user.email} />;

  const broadcasts = await listRecentBroadcasts(100);
  const totalSent = broadcasts.reduce((s, b) => s + b.sentCount, 0);
  const totalFailed = broadcasts.reduce((s, b) => s + b.failedCount, 0);

  return (
    <AdminShell email={gate.user.email}>
      <PageHeader
        eyebrow="InvoxAI · admin"
        title="Broadcasts"
        description="Email broadcasts across all sellers — oversight of volume and delivery health."
      />

      <div className="mb-4 grid grid-cols-3 gap-4">
        <GlassCard>
          <div className="text-xs text-muted">Broadcasts</div>
          <div className="mt-1 text-2xl font-bold text-zinc-900">{broadcasts.length}</div>
        </GlassCard>
        <GlassCard>
          <div className="text-xs text-muted">Emails sent</div>
          <div className="mt-1 text-2xl font-bold text-emerald-700">{totalSent}</div>
        </GlassCard>
        <GlassCard>
          <div className="text-xs text-muted">Failed</div>
          <div className="mt-1 text-2xl font-bold text-zinc-900">{totalFailed}</div>
        </GlassCard>
      </div>

      <GlassCard title={`Recent broadcasts (${broadcasts.length})`}>
        {broadcasts.length === 0 ? (
          <p className="text-sm text-muted">No broadcasts sent yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {broadcasts.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-zinc-900">
                      {b.tenant.name?.trim() || b.tenant.username}
                    </span>
                    <Badge tone={STATUS_TONE[b.status] ?? "neutral"}>{b.status.toLowerCase()}</Badge>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted">{b.subject}</div>
                </div>
                <div className="shrink-0 text-right text-xs text-muted">
                  <div className="font-medium text-zinc-700">
                    {b.sentCount}/{b.recipientCount}
                    {b.failedCount > 0 ? ` · ${b.failedCount} failed` : ""}
                  </div>
                  <div className="mt-0.5">{formatDateTimeShortIST(b.createdAt)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </AdminShell>
  );
}
