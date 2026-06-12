import { GlassCard } from "@invoxai/ui";
import { listTenantOrders, getTenantSalesSummary } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";
import { updateOrderFulfillmentAction } from "./actions";
import { RefundForm } from "./RefundForm";

export const dynamic = "force-dynamic";

const STATUSES = ["NEW", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] as const;

function tabCls(active: boolean): string {
  return `rounded-full px-3 py-1 text-xs font-medium ${
    active
      ? "bg-brand text-white"
      : "border border-white/10 text-muted hover:border-neutral-900"
  }`;
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { tenant } = await requireTenant();
  const { status: rawStatus } = await searchParams;
  const activeStatus = STATUSES.includes(rawStatus as (typeof STATUSES)[number])
    ? (rawStatus as (typeof STATUSES)[number])
    : undefined;

  const [orders, summary] = await Promise.all([
    listTenantOrders(tenant.id, activeStatus),
    getTenantSalesSummary(tenant.id),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-muted">
        InvoxAI · orders
      </p>
      <h1 className="mt-1 text-3xl font-bold">Orders</h1>
      <p className="mt-2 text-muted">
        Every paid order, with fulfillment status your buyers can see.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <GlassCard title="Orders">
          <p className="text-2xl font-bold">{summary.orderCount}</p>
        </GlassCard>
        <GlassCard title="Gross sales">
          <p className="text-2xl font-bold">{formatRupees(summary.grossPaise)}</p>
          <p className="mt-1 text-xs text-muted">Settled to your gateway</p>
        </GlassCard>
        <GlassCard title="InvoxAI commission">
          <p className="text-2xl font-bold">
            {formatRupees(summary.commissionPaidPaise)}
          </p>
          {summary.commissionDuePaise > 0 ? (
            <p className="mt-1 text-xs text-warning">
              {formatRupees(summary.commissionDuePaise)} due (settles on top-up)
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted">From your wallet</p>
          )}
        </GlassCard>
      </div>

      <div className="mt-10 flex items-center justify-between">
        <h2 className="text-xl font-bold">Orders</h2>
        {orders.length > 0 ? (
          <a
            href="/orders/export"
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/5"
          >
            Export CSV
          </a>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <a href="/orders" className={tabCls(!activeStatus)}>
          All
        </a>
        {STATUSES.map((s) => (
          <a key={s} href={`/orders?status=${s}`} className={tabCls(activeStatus === s)}>
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </a>
        ))}
      </div>

      {orders.length === 0 ? (
        <p className="mt-4 text-muted">
          {activeStatus ? `No ${activeStatus.toLowerCase()} orders.` : "No orders yet."}
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="rounded-xl border border-white/10 bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-white">
                    {o.itemTitle ?? o.paymentPage?.title ?? "Order"}
                    {o.quantity > 1 ? (
                      <span className="ml-1 text-sm font-normal text-muted">
                        ×{o.quantity}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 text-sm text-muted">
                    {formatRupees(o.amountPaise)} · {formatDate(o.paidAt)}
                    {o.buyerEmail ? ` · ${o.buyerEmail}` : ""}
                  </div>
                  {o.orderItems.length > 0 ? (
                    <ul className="mt-1 text-xs text-muted">
                      {o.orderItems.map((li, idx) => (
                        <li key={idx}>
                          {li.titleSnapshot} ×{li.quantity} · {formatRupees(li.unitPricePaise)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {o.discountPaise > 0 ? (
                    <div className="mt-0.5 text-xs font-medium text-green-700">
                      {o.couponCode ? `${o.couponCode}: ` : "Discount: "}
                      −{formatRupees(o.discountPaise)} (subtotal{" "}
                      {formatRupees(o.amountPaise + o.discountPaise)})
                    </div>
                  ) : null}
                  {o.refundedPaise > 0 ? (
                    <div className="mt-0.5 text-xs font-medium text-red-700">
                      Refunded {formatRupees(o.refundedPaise)}
                      {o.refundedPaise >= o.amountPaise ? " (full)" : " (partial)"}
                    </div>
                  ) : null}
                </div>
                <form
                  action={updateOrderFulfillmentAction.bind(null, o.id)}
                  className="flex flex-wrap items-center gap-2"
                >
                  <select
                    name="status"
                    defaultValue={o.fulfillmentStatus}
                    className="rounded-lg border border-white/10 px-2 py-1.5 text-sm"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.charAt(0) + s.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                  <input
                    name="note"
                    defaultValue={o.trackingNote ?? ""}
                    placeholder="Tracking / note"
                    className="w-44 rounded-lg border border-white/10 px-2 py-1.5 text-sm outline-none focus:border-brand"
                  />
                  <button className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white">
                    Save
                  </button>
                </form>
              </div>
              {o.razorpayPaymentId && o.refundedPaise < o.amountPaise ? (
                <div className="mt-3 border-t border-neutral-100 pt-3">
                  <RefundForm orderId={o.id} remainingPaise={o.amountPaise - o.refundedPaise} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
