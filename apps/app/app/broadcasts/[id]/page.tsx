import Link from "next/link";
import { notFound } from "next/navigation";
import { GlassCard, PageHeader, Badge } from "@invoxai/ui";
import { getBroadcastWithRecipients, segmentCounts, normalizeSegment } from "@invoxai/db";
import { formatDateIST } from "@invoxai/utils/date";
import { requireTenant } from "../../../lib/tenant";
import { BroadcastForm } from "../BroadcastForm";
import {
  updateBroadcastAction,
  sendBroadcastAction,
  cancelBroadcastAction,
  deleteBroadcastAction,
} from "../actions";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "neutral" | "cyan" | "success"> = {
  DRAFT: "neutral",
  QUEUED: "cyan",
  SENDING: "cyan",
  SENT: "success",
  CANCELLED: "neutral",
};

const SEGMENT_LABEL: Record<string, string> = {
  ALL: "Everyone",
  CUSTOMERS: "Customers",
  LEADS: "Leads",
};

export default async function BroadcastDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenant } = await requireTenant();
  const { id } = await params;
  const broadcast = await getBroadcastWithRecipients(tenant.id, id);
  if (!broadcast) notFound();

  const isDraft = broadcast.status === "DRAFT";
  const counts = isDraft ? await segmentCounts(tenant.id) : null;
  const segment = normalizeSegment(broadcast.segment);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="InvoxAI · growth"
        title={broadcast.name}
        description={broadcast.subject}
        actions={<Badge tone={STATUS_TONE[broadcast.status] ?? "neutral"}>{broadcast.status.toLowerCase()}</Badge>}
      />
      <Link href="/broadcasts" className="mb-4 inline-block text-sm text-muted underline">
        ← All broadcasts
      </Link>

      {isDraft ? (
        <>
          <GlassCard className="mb-4">
            <h2 className="mb-3 text-sm font-semibold text-zinc-900">Edit draft</h2>
            <BroadcastForm
              action={updateBroadcastAction.bind(null, id)}
              counts={counts!}
              initial={{
                name: broadcast.name,
                subject: broadcast.subject,
                body: broadcast.body,
                segment,
              }}
              submitLabel="Save changes"
            />
          </GlassCard>

          <GlassCard>
            <h2 className="text-sm font-semibold text-zinc-900">Send</h2>
            <p className="mt-1 text-sm text-muted">
              This will email <strong>{counts![segment]}</strong> {SEGMENT_LABEL[segment]?.toLowerCase()} contact
              {counts![segment] === 1 ? "" : "s"}. Sending can’t be undone.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <form action={sendBroadcastAction.bind(null, id)}>
                <button
                  type="submit"
                  disabled={counts![segment] === 0}
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Send to {counts![segment]} contact{counts![segment] === 1 ? "" : "s"}
                </button>
              </form>
              <form action={deleteBroadcastAction.bind(null, id)}>
                <button type="submit" className="text-sm text-red-600 underline">
                  Delete draft
                </button>
              </form>
            </div>
          </GlassCard>
        </>
      ) : (
        <>
          <GlassCard className="mb-4">
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-muted">Audience</dt>
                <dd className="mt-0.5 font-medium text-zinc-900">{SEGMENT_LABEL[segment] ?? segment}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Recipients</dt>
                <dd className="mt-0.5 font-medium text-zinc-900">{broadcast.recipientCount}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Sent</dt>
                <dd className="mt-0.5 font-medium text-emerald-700">{broadcast.sentCount}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Failed</dt>
                <dd className="mt-0.5 font-medium text-zinc-900">{broadcast.failedCount}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-muted">
              {broadcast.status === "QUEUED" || broadcast.status === "SENDING"
                ? "Delivering — broadcasts are sent by a scheduled worker, so this updates over a few minutes."
                : broadcast.status === "SENT"
                  ? `Sent ${broadcast.sentAt ? formatDateIST(broadcast.sentAt) : ""}.`
                  : "This broadcast was cancelled."}
            </p>
            {broadcast.status === "QUEUED" ? (
              <form action={cancelBroadcastAction.bind(null, id)} className="mt-3">
                <button type="submit" className="text-sm text-red-600 underline">
                  Cancel before it sends
                </button>
              </form>
            ) : null}
          </GlassCard>

          <GlassCard className="mb-4">
            <h2 className="mb-2 text-sm font-semibold text-zinc-900">Message</h2>
            <p className="text-sm font-medium text-zinc-900">{broadcast.subject}</p>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">{broadcast.body}</p>
          </GlassCard>

          {broadcast.recipients.length > 0 ? (
            <GlassCard>
              <h2 className="mb-2 text-sm font-semibold text-zinc-900">
                Recipients ({broadcast.recipients.length})
              </h2>
              <ul className="divide-y divide-zinc-100 text-sm">
                {broadcast.recipients.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="truncate text-zinc-700">{r.email}</span>
                    <span className="shrink-0 text-xs text-muted">{r.status.toLowerCase()}</span>
                  </li>
                ))}
              </ul>
            </GlassCard>
          ) : null}
        </>
      )}
    </div>
  );
}
