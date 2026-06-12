import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getBuyerOrder } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { resolveTenantByHost } from "../../../../lib/resolve";
import { getSessionUser } from "../../../../lib/auth";
import { PrintButton } from "./PrintButton";
import { LinkifiedText } from "../../../LinkifiedText";

export const dynamic = "force-dynamic";

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

const STATUS_LABEL: Record<string, string> = {
  NEW: "Order placed",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export default async function OrderReceipt({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) notFound();

  const user = await getSessionUser();
  if (!user) redirect("/account/login");

  const { id } = await params;
  // ACCESS CONTROL: only returns the order if it belongs to THIS buyer; any other
  // (or fabricated) id → null → 404, so orders can't be probed across buyers.
  const order = await getBuyerOrder({
    tenantId: tenant.id,
    orderId: id,
    profileId: user.id,
    email: user.email ?? null,
  });
  if (!order) notFound();

  const subtotal = order.amountPaise + order.discountPaise;
  const sellerName = tenant.name ?? tenant.username;

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/account" className="text-sm text-cyan underline">
          ← Your orders
        </Link>
        <PrintButton />
      </div>

      <div className="mt-6 rounded-xl border border-white/10 bg-surface p-6">
        <header className="border-b border-white/10 pb-4">
          <h1 className="text-lg font-bold text-white">{sellerName}</h1>
          <p className="mt-0.5 text-sm text-muted">Receipt</p>
        </header>

        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Order</dt>
            <dd className="font-mono text-neutral-200">{order.id.slice(0, 8)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Date</dt>
            <dd className="text-neutral-200">{formatDate(order.paidAt)}</dd>
          </div>
          {order.razorpayPaymentId ? (
            <div className="flex justify-between">
              <dt className="text-muted">Payment</dt>
              <dd className="font-mono text-neutral-200">{order.razorpayPaymentId}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-muted">Status</dt>
            <dd className="text-neutral-200">
              {STATUS_LABEL[order.fulfillmentStatus] ?? order.fulfillmentStatus}
            </dd>
          </div>
        </dl>

        {/* Items */}
        <div className="mt-4 border-t border-white/10 pt-4">
          {order.orderItems.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {order.orderItems.map((li, i) => (
                <li key={i} className="flex justify-between">
                  <span className="text-neutral-200">
                    {li.titleSnapshot} × {li.quantity}
                  </span>
                  <span className="text-neutral-200">
                    {formatRupees(li.unitPricePaise * li.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex justify-between text-sm">
              <span className="text-neutral-200">
                {order.itemTitle ?? order.paymentPage?.title ?? "Order"}
              </span>
              <span className="text-neutral-200">{formatRupees(subtotal)}</span>
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="mt-4 space-y-1 border-t border-white/10 pt-4 text-sm">
          {order.discountPaise > 0 ? (
            <>
              <div className="flex justify-between text-muted">
                <span>Subtotal</span>
                <span>{formatRupees(subtotal)}</span>
              </div>
              <div className="flex justify-between text-green-700">
                <span>{order.couponCode ? `Discount (${order.couponCode})` : "Discount"}</span>
                <span>−{formatRupees(order.discountPaise)}</span>
              </div>
            </>
          ) : null}
          <div className="flex justify-between border-t border-white/10 pt-1 font-semibold text-white">
            <span>Total paid</span>
            <span>{formatRupees(order.amountPaise)}</span>
          </div>
          {order.refundedPaise > 0 ? (
            <div className="flex justify-between font-medium text-red-700">
              <span>Refunded</span>
              <span>−{formatRupees(order.refundedPaise)}</span>
            </div>
          ) : null}
        </div>

        {order.trackingNote ? (
          <p className="mt-4 border-t border-white/10 pt-4 text-xs text-muted">
            <LinkifiedText text={order.trackingNote} />
          </p>
        ) : null}
      </div>

      <p className="mt-4 text-center text-xs text-muted">
        Paid to {sellerName} via Razorpay.
      </p>
    </main>
  );
}
