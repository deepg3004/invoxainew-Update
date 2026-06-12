import Link from "next/link";
import { GlassCard } from "@invoxai/ui";
import { listAbandonedCheckouts } from "@invoxai/db";
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

export default async function AbandonedPage() {
  const { tenant } = await requireTenant();
  const carts = await listAbandonedCheckouts(tenant.id, { take: 100 });

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-muted">
        InvoxAI · recovery
      </p>
      <h1 className="mt-1 text-3xl font-bold">Abandoned checkouts</h1>
      <p className="mt-2 text-muted">
        Buyers who started paying but didn’t finish (older than 30 minutes). Reach
        out with the contact they entered to recover the sale.
      </p>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-muted">
        💡 Automatic email / WhatsApp recovery nudges turn on once you connect an
        email provider. For now, follow up manually below.
      </div>

      {carts.length === 0 ? (
        <p className="mt-8 text-muted">
          No abandoned checkouts. When someone starts but doesn’t complete a
          payment, they’ll show up here.
        </p>
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
                    <div className="font-medium text-white">
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
                        className="block font-medium text-cyan underline"
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
                        className="mt-0.5 block text-xs text-muted underline hover:text-white"
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

      <p className="mt-8 text-sm text-muted">
        <Link href="/orders" className="text-cyan underline">
          ← Back to orders
        </Link>
      </p>
    </div>
  );
}
