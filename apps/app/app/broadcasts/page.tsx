import Link from "next/link";
import { GlassCard, PageHeader, Badge } from "@invoxai/ui";
import { serverEnv } from "@invoxai/config";
import { listBroadcasts } from "@invoxai/db";
import { formatDateIST } from "@invoxai/utils/date";
import { requireTenant } from "../../lib/tenant";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "neutral" | "cyan" | "success" | "brand"> = {
  DRAFT: "neutral",
  QUEUED: "cyan",
  SENDING: "cyan",
  SENT: "success",
  CANCELLED: "neutral",
};

export default async function BroadcastsPage() {
  const { tenant } = await requireTenant();
  const [broadcasts] = await Promise.all([listBroadcasts(tenant.id)]);
  const emailReady = Boolean(serverEnv().RESEND_API_KEY);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="InvoxAI · growth"
        title="Broadcasts"
        description="Send a one-off email to your contacts — everyone, just customers, or just leads."
        actions={
          <Link href="/broadcasts/new" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">
            New broadcast
          </Link>
        }
      />

      {!emailReady ? (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Email sending isn’t configured yet. You can compose broadcasts now, but they won’t be delivered until
          a <code>RESEND_API_KEY</code> is set and the broadcasts cron is scheduled. Until then, sending marks
          recipients as “skipped”.
        </div>
      ) : null}

      {broadcasts.length === 0 ? (
        <GlassCard>
          <p className="text-sm text-muted">
            No broadcasts yet.{" "}
            <Link href="/broadcasts/new" className="text-brand-strong underline">
              Compose your first one
            </Link>
            .
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-2">
          {broadcasts.map((b) => (
            <Link
              key={b.id}
              href={`/broadcasts/${b.id}`}
              className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-surface p-4 no-underline transition hover:border-brand/30 hover:shadow-card"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-zinc-900">{b.name}</span>
                  <Badge tone={STATUS_TONE[b.status] ?? "neutral"}>{b.status.toLowerCase()}</Badge>
                </div>
                <div className="mt-0.5 truncate text-sm text-muted">{b.subject}</div>
              </div>
              <div className="shrink-0 text-right text-xs text-muted">
                {b.status === "SENT" || b.status === "SENDING" ? (
                  <div className="font-medium text-zinc-700">
                    {b.sentCount}/{b.recipientCount} sent
                    {b.failedCount > 0 ? ` · ${b.failedCount} failed` : ""}
                  </div>
                ) : b.status === "QUEUED" ? (
                  <div className="font-medium text-zinc-700">{b.recipientCount} queued</div>
                ) : null}
                <div className="mt-0.5">{formatDateIST(b.createdAt)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
