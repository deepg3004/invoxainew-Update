import { formatDateTimeShortIST } from "@invoxai/utils/date";
import { PageHeader, Pagination, pageSlice } from "@invoxai/ui";
import { listActivityLog, countActivityLog } from "@invoxai/db";
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

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { tenant } = await requireTenant();
  const { page: rawPage } = await searchParams;
  const total = await countActivityLog(tenant.id);
  const { page, totalPages, skip, take } = pageSlice(total, rawPage, 10);
  const items = await listActivityLog(tenant.id, { skip, take });
  const firstOnPage = total === 0 ? 0 : skip + 1;
  const lastOnPage = skip + items.length;

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
      {total > 0 ? (
        <Pagination
          page={page}
          totalPages={totalPages}
          firstOnPage={firstOnPage}
          lastOnPage={lastOnPage}
          total={total}
          hrefFor={(p) => (p > 1 ? `/activity?page=${p}` : "/activity")}
          label="events"
        />
      ) : null}
    </div>
  );
}
