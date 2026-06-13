import { Button, GlassCard, PageHeader, Pagination, pageSlice } from "@invoxai/ui";
import { listAbandonedCheckouts, countAbandonedCheckouts } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";

export const dynamic = "force-dynamic";

function timeAgo(d: Date): string {
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default async function AbandonedPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; size?: string }>;
}) {
  const { tenant } = await requireTenant();
  const { page: rawPage, size: rawSize } = await searchParams;
  const total = await countAbandonedCheckouts(tenant.id);
  const { page, totalPages, skip, take, pageSize } = pageSlice(total, rawPage, rawSize);
  const carts = await listAbandonedCheckouts(tenant.id, { skip, take });
  const firstOnPage = total === 0 ? 0 : skip + 1;
  const lastOnPage = skip + carts.length;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · recovery"
        title="Abandoned checkouts"
        description="Buyers who started paying but didn’t finish (older than 30 minutes). Reach out with the contact they entered to recover the sale."
      />

      <GlassCard className="text-sm text-muted">
        💡 Automatic email / WhatsApp recovery nudges turn on once you connect an
        email provider. For now, follow up manually below.
      </GlassCard>

      {carts.length === 0 ? (
        <GlassCard className="mt-6 text-muted">
          No abandoned checkouts. When someone starts but doesn’t complete a
          payment, they’ll show up here.
        </GlassCard>
      ) : (
        <div className="mt-8 space-y-3">
          {carts.map((c) => {
            const itemLabel =
              c.itemTitle ??
              c.paymentPage?.title ??
              (c.orderItems.length > 0
                ? `${c.orderItems.length} item${c.orderItems.length === 1 ? "" : "s"}`
                : "Checkout");
            return (
              <GlassCard key={c.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-zinc-900">
                      {itemLabel}
                      {c.quantity > 1 ? (
                        <span className="ml-1 text-sm font-normal text-muted">
                          ×{c.quantity}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-sm text-muted">
                      {formatRupees(c.amountPaise)} · started {timeAgo(c.createdAt)}
                    </div>
                    {c.orderItems.length > 0 ? (
                      <ul className="mt-1 text-xs text-muted">
                        {c.orderItems.map((li, idx) => (
                          <li key={idx}>
                            {li.titleSnapshot} ×{li.quantity}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <div className="text-right text-sm">
                    {c.buyerEmail ? (
                      <a
                        href={`mailto:${c.buyerEmail}?subject=${encodeURIComponent(
                          "Complete your order",
                        )}`}
                        className="block font-medium text-brand-strong underline"
                      >
                        {c.buyerEmail}
                      </a>
                    ) : (
                      <span className="block text-muted">No email</span>
                    )}
                    {c.buyerContact ? (
                      <a
                        href={`https://wa.me/${c.buyerContact.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-0.5 block text-xs text-muted underline hover:text-zinc-900"
                      >
                        {c.buyerContact} · WhatsApp
                      </a>
                    ) : null}
                  </div>
                </div>
              </GlassCard>
            );
          })}
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
          label="checkouts"
        />
      ) : null}

      <div className="mt-8">
        <Button href="/orders" variant="secondary" size="sm">
          ← Back to orders
        </Button>
      </div>
    </div>
  );
}
