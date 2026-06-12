import { formatDateTimeShortIST } from "@invoxai/utils/date";
import { PageHeader } from "@invoxai/ui";
import { listActivityLog } from "@invoxai/db";
import { requireTenant } from "../../lib/tenant";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  "gateway.connected": "Payment gateway connected",
  "gateway.disconnected": "Payment gateway disconnected",
  "page.generated": "AI page generated",
  "page.published": "AI page published",
  "page.unpublished": "AI page unpublished",
  "product.published": "Product published",
  "product.unpublished": "Product unpublished",
  "product.archived": "Product archived",
  "order.refunded": "Order refunded",
  "domain.verified": "Custom domain verified",
};

function label(action: string): string {
  return LABELS[action] ?? action.replace(/[._]/g, " ");
}

export default async function ActivityPage() {
  const { tenant } = await requireTenant();
  const items = await listActivityLog(tenant.id);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI"
        title="Activity"
        description="Recent important events on your account — gateway changes, publishes, refunds and more."
      />
      {items.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No activity yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-surface">
          {items.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <div className="min-w-0">
                <span className="font-medium text-zinc-900">{label(a.action)}</span>
                {a.detail ? <span className="ml-2 text-muted">{a.detail}</span> : null}
              </div>
              <span className="shrink-0 text-xs text-muted">
                {formatDateTimeShortIST(a.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
