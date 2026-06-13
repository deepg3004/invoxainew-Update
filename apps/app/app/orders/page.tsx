import {formatDateIST} from "@invoxai/utils/date";
import { Button, GlassCard, PageHeader, StatCard, Pagination } from "@invoxai/ui";
import {
  listTenantOrders,
  countTenantOrders,
  getTenantSalesSummary,
  listPendingUpiOrders,
} from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";
import { updateOrderFulfillmentAction, advanceOrderAction, confirmUpiOrderAction } from "./actions";
import { RefundForm } from "./RefundForm";
import { CancelUpiButton } from "./CancelUpiButton";

export const dynamic = "force-dynamic";

const STATUSES = ["NEW", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] as const;

// Forward fulfillment flow for the one-tap "advance" button.
const FLOW = ["NEW", "PROCESSING", "SHIPPED", "DELIVERED"] as const;
function nextStatus(s: string): string | null {
  const i = (FLOW as readonly string[]).indexOf(s);
  return i >= 0 && i < FLOW.length - 1 ? (FLOW[i + 1] as string) : null;
}
const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

function tabCls(active: boolean): string {
  return `rounded-full px-3 py-1 text-xs font-medium ${
    active
      ? "bg-brand text-white"
      : "border border-zinc-200 text-muted hover:border-zinc-300"
  }`;
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return formatDateIST(d);
}

const PAGE_SIZE = 10;

/** Build an /orders URL preserving status + search + page (page omitted when 1). */
function buildHref(params: { status?: string; q?: string; page?: number }): string {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.q) sp.set("q", params.q);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `/orders?${qs}` : "/orders";
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const { tenant } = await requireTenant();
  const { status: rawStatus, q: rawQ, page: rawPage } = await searchParams;
  const activeStatus = STATUSES.includes(rawStatus as (typeof STATUSES)[number])
    ? (rawStatus as (typeof STATUSES)[number])
    : undefined;
  const search = (rawQ ?? "").trim();
  const filter = { status: activeStatus, search: search || undefined };

  // Count first so the requested page can be clamped into range, then fetch the
  // page slice. Summary stays GLOBAL (full totals, unaffected by the filter).
  const [total, summary, pendingUpi] = await Promise.all([
    countTenantOrders(tenant.id, filter),
    getTenantSalesSummary(tenant.id),
    listPendingUpiOrders(tenant.id),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(
    Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1),
    totalPages,
  );
  const orders = await listTenantOrders(tenant.id, {
    ...filter,
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const firstOnPage = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastOnPage = (page - 1) * PAGE_SIZE + orders.length;

  const exportHref = `/orders/export${(() => {
    const sp = new URLSearchParams();
    if (activeStatus) sp.set("status", activeStatus);
    if (search) sp.set("q", search);
    return sp.toString() ? `?${sp}` : "";
  })()}`;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · orders"
        title="Orders"
        description="Every paid order, with fulfillment status your buyers can see."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Orders" value={summary.orderCount} />
        <StatCard
          label="Gross sales"
          value={formatRupees(summary.grossPaise)}
          hint="Settled to your gateway"
        />
        <StatCard
          label="InvoxAI commission"
          value={formatRupees(summary.commissionPaidPaise)}
          hint={
            summary.commissionDuePaise > 0
              ? `${formatRupees(summary.commissionDuePaise)} due (settles on top-up)`
              : "From your wallet"
          }
          accent={summary.commissionDuePaise > 0 ? "warning" : undefined}
        />
      </div>

      {pendingUpi.length > 0 ? (
        <GlassCard className="mt-8 border-amber-200" title={`Awaiting UPI confirmation (${pendingUpi.length})`}>
          <p className="text-sm text-muted">
            The buyer says they paid your UPI. Check your UPI/bank app for the amount and
            reference, then confirm — confirming finalises the order and charges the InvoxAI
            commission from your wallet.
          </p>
          <ul className="mt-3 divide-y divide-zinc-100">
            {pendingUpi.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium text-zinc-900">
                    {o.itemTitle ?? o.paymentPage?.title ?? "Order"} · {formatRupees(o.amountPaise)}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {formatDate(o.createdAt)}
                    {o.buyerEmail ? ` · ${o.buyerEmail}` : ""}
                    {o.upiRef ? <> · UTR <span className="font-mono">{o.upiRef}</span></> : null}
                  </div>
                </div>
                <form action={confirmUpiOrderAction.bind(null, o.id)}>
                  <button className="whitespace-nowrap rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white">
                    Confirm payment
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </GlassCard>
      ) : null}

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900">Orders</h2>
        {total > 0 ? (
          <Button href={exportHref} variant="secondary" size="sm">
            Export CSV
          </Button>
        ) : null}
      </div>

      <form method="get" className="mt-4 flex flex-wrap items-center gap-2">
        {activeStatus ? (
          <input type="hidden" name="status" value={activeStatus} />
        ) : null}
        <input
          name="q"
          defaultValue={search}
          placeholder="Search buyer email, phone, item, payment id…"
          className="w-full max-w-xs rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand"
        />
        <Button type="submit" variant="secondary" size="sm">
          Search
        </Button>
        {search ? (
          <a
            href={buildHref({ status: activeStatus })}
            className="px-2 py-1.5 text-sm text-muted hover:text-zinc-900"
          >
            Clear
          </a>
        ) : null}
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        <a href={buildHref({ q: search })} className={tabCls(!activeStatus)}>
          All
        </a>
        {STATUSES.map((s) => (
          <a
            key={s}
            href={buildHref({ status: s, q: search })}
            className={tabCls(activeStatus === s)}
          >
            {titleCase(s)}
          </a>
        ))}
      </div>

      {orders.length === 0 ? (
        <GlassCard className="mt-4">
          <p className="text-sm text-muted">
            {search
              ? `No orders match “${search}”${
                  activeStatus ? ` in ${activeStatus.toLowerCase()}` : ""
                }.`
              : activeStatus
                ? `No ${activeStatus.toLowerCase()} orders.`
                : "No orders yet."}
          </p>
        </GlassCard>
      ) : (
        <>
        <div className="mt-4 space-y-3">
          {orders.map((o) => (
            <GlassCard key={o.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-zinc-900">
                    {o.itemTitle ?? o.paymentPage?.title ?? "Order"}
                    {o.quantity > 1 ? (
                      <span className="ml-1 text-sm font-normal text-muted">
                        ×{o.quantity}
                      </span>
                    ) : null}
                    {o.paymentMethod === "UPI_MANUAL" ? (
                      <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand-strong align-middle">
                        UPI
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
                <div className="flex flex-col items-end gap-2">
                  {nextStatus(o.fulfillmentStatus) ? (
                    <form
                      action={advanceOrderAction.bind(
                        null,
                        o.id,
                        nextStatus(o.fulfillmentStatus)!,
                      )}
                    >
                      <Button type="submit" size="sm" className="whitespace-nowrap">
                        Mark {titleCase(nextStatus(o.fulfillmentStatus)!)} →
                      </Button>
                    </form>
                  ) : null}
                  <form
                    action={updateOrderFulfillmentAction.bind(null, o.id)}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <select
                      name="status"
                      defaultValue={o.fulfillmentStatus}
                      className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {titleCase(s)}
                        </option>
                      ))}
                    </select>
                    <input
                      name="note"
                      defaultValue={o.trackingNote ?? ""}
                      placeholder="Tracking / note"
                      className="w-44 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand"
                    />
                    <Button type="submit" size="sm">
                      Save
                    </Button>
                  </form>
                </div>
              </div>
              {o.razorpayPaymentId && o.refundedPaise < o.amountPaise ? (
                <div className="mt-3 border-t border-zinc-200 pt-3">
                  <RefundForm orderId={o.id} remainingPaise={o.amountPaise - o.refundedPaise} />
                </div>
              ) : null}
              {o.paymentMethod === "UPI_MANUAL" ? (
                <div className="mt-3 border-t border-zinc-200 pt-3">
                  <CancelUpiButton id={o.id} />
                </div>
              ) : null}
            </GlassCard>
          ))}
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          firstOnPage={firstOnPage}
          lastOnPage={lastOnPage}
          total={total}
          hrefFor={(p) => buildHref({ status: activeStatus, q: search, page: p })}
          label="orders"
        />
        </>
      )}
    </div>
  );
}
