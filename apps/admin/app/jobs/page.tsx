import { GlassCard, PageHeader, StatCard } from "@invoxai/ui";
import { getNotificationsQueueHealth } from "@invoxai/jobs";
import { requireAdmin } from "../../lib/auth";
import { AdminShell } from "../components/AdminShell";
import { NotAuthorized } from "../components/NotAuthorized";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const gate = await requireAdmin();
  if (!gate.ok) return <NotAuthorized email={gate.user.email} />;

  const health = await getNotificationsQueueHealth();
  const queueEnabled = process.env.NOTIFICATIONS_USE_QUEUE === "true";

  return (
    <AdminShell email={gate.user.email}>
      <PageHeader
        eyebrow="InvoxAI · system"
        title="Background jobs"
        description="Health of the BullMQ notification queue (seller/buyer sale notifications + emails)."
      />

      {/* Mode banner */}
      <div
        className={`mb-6 rounded-xl border p-4 text-sm ${
          queueEnabled
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-zinc-200 bg-zinc-50 text-muted"
        }`}
      >
        {queueEnabled ? (
          <>
            <strong>Queue mode is ON.</strong> The tenant app enqueues sale notifications and the{" "}
            <code>invox-worker</code> service processes them. (NOTIFICATIONS_USE_QUEUE=true)
          </>
        ) : (
          <>
            <strong>Queue mode is OFF</strong> — notifications run inline (default). Turn it on by
            installing the worker and setting <code>NOTIFICATIONS_USE_QUEUE=true</code> (see
            infra/WORKER.md). Counts below stay at zero until then.
          </>
        )}
      </div>

      {health ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Waiting" value={health.waiting} />
            <StatCard label="Active" value={health.active} />
            <StatCard
              label="Failed"
              value={health.failed}
              accent={health.failed > 0 ? "warning" : undefined}
            />
            <StatCard label="Delayed" value={health.delayed} />
            <StatCard label="Completed" value={health.completed} />
            <StatCard label="Paused" value={health.paused} />
          </div>
          <p className="mt-4 text-xs text-muted">
            Completed jobs are pruned after 1 hour; failed jobs are kept 24 hours for inspection.
            “Failed” counts jobs that exhausted all retries — investigate via{" "}
            <code>journalctl -u invox-worker</code>.
          </p>
        </>
      ) : (
        <GlassCard>
          <p className="text-sm text-warning">
            Queue unreachable — couldn’t read job counts from Redis. Check that Redis is running and{" "}
            <code>REDIS_URL</code> is correct.
          </p>
        </GlassCard>
      )}
    </AdminShell>
  );
}
