import Link from "next/link";
import { formatDateIST } from "@invoxai/utils/date";
import { GlassCard, PageHeader } from "@invoxai/ui";
import { listSellerTickets } from "@invoxai/db";
import { requireTenant } from "../../lib/tenant";

export const dynamic = "force-dynamic";

type Meta = { label: string; cls: string };
const STATUS_META: Record<string, Meta> = {
  OPEN: { label: "Needs reply", cls: "bg-amber-50 text-amber-700" },
  ANSWERED: { label: "Answered", cls: "bg-green-50 text-green-700" },
  CLOSED: { label: "Closed", cls: "bg-zinc-100 text-muted" },
};
const FALLBACK_META: Meta = { label: "Open", cls: "bg-amber-50 text-amber-700" };

export default async function SupportInboxPage() {
  const { tenant } = await requireTenant();
  const tickets = await listSellerTickets(tenant.id);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · support"
        title="Support inbox"
        description="Messages from your buyers. Reply to help them and keep your store trusted."
      />

      {tickets.length === 0 ? (
        <GlassCard>
          <p className="text-muted">
            No support messages yet. Buyers can reach you from their account area.
          </p>
        </GlassCard>
      ) : (
        <GlassCard className="divide-y divide-zinc-100 p-0">
          {tickets.map((t) => {
            const meta = STATUS_META[t.status] ?? FALLBACK_META;
            return (
              <Link
                key={t.id}
                href={`/support/${t.id}`}
                className="flex items-center justify-between gap-4 p-4 hover:bg-zinc-50"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-zinc-900">{t.subject}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.cls}`}>
                      {meta.label}
                    </span>
                  </div>
                  <div className="mt-0.5 text-sm text-muted">
                    {t.buyerEmail} · {t._count.messages} message
                    {t._count.messages === 1 ? "" : "s"}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-muted">{formatDateIST(t.updatedAt)}</span>
              </Link>
            );
          })}
        </GlassCard>
      )}
    </div>
  );
}
