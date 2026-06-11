import { Card } from "@invoxai/ui";
import { listTenantOrders, getTenantSalesSummary } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";
import { updateOrderFulfillmentAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUSES = ["NEW", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] as const;

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export default async function OrdersPage() {
  const { tenant } = await requireTenant();
  const [orders, summary] = await Promise.all([
    listTenantOrders(tenant.id),
    getTenantSalesSummary(tenant.id),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-neutral-400">
        InvoxAI · orders
      </p>
      <h1 className="mt-1 text-3xl font-bold">Orders</h1>
      <p className="mt-2 text-neutral-500">
        Every paid order, with fulfillment status your buyers can see.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Card title="Orders">
          <p className="text-2xl font-bold">{summary.orderCount}</p>
        </Card>
        <Card title="Gross sales">
          <p className="text-2xl font-bold">{formatRupees(summary.grossPaise)}</p>
          <p className="mt-1 text-xs text-neutral-400">Settled to your gateway</p>
        </Card>
        <Card title="InvoxAI commission">
          <p className="text-2xl font-bold">
            {formatRupees(summary.commissionPaidPaise)}
          </p>
          {summary.commissionDuePaise > 0 ? (
            <p className="mt-1 text-xs text-amber-600">
              {formatRupees(summary.commissionDuePaise)} due (settles on top-up)
            </p>
          ) : (
            <p className="mt-1 text-xs text-neutral-400">From your wallet</p>
          )}
        </Card>
      </div>

      <h2 className="mt-10 text-xl font-bold">All orders</h2>
      {orders.length === 0 ? (
        <p className="mt-3 text-neutral-500">No orders yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-neutral-900">
                    {o.paymentPage.title}
                  </div>
                  <div className="mt-0.5 text-sm text-neutral-500">
                    {formatRupees(o.amountPaise)} · {formatDate(o.paidAt)}
                    {o.buyerEmail ? ` · ${o.buyerEmail}` : ""}
                  </div>
                </div>
                <form
                  action={updateOrderFulfillmentAction.bind(null, o.id)}
                  className="flex flex-wrap items-center gap-2"
                >
                  <select
                    name="status"
                    defaultValue={o.fulfillmentStatus}
                    className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
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
                    className="w-44 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-neutral-900"
                  />
                  <button className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white">
                    Save
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
