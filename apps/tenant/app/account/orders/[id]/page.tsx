import {formatDateTimeIST} from "@invoxai/utils/date";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getBuyerOrder, getBuyerReviewForProduct } from "@invoxai/db";
import { createSignedDownloadUrl } from "@invoxai/auth/server";
import { formatRupees } from "@invoxai/utils/money";
import { safeUrl } from "@invoxai/utils/blocks";
import { resolveTenantByHost } from "../../../../lib/resolve";
import { getSessionUser } from "../../../../lib/auth";
import { PrintButton } from "./PrintButton";
import { ReviewForm } from "./ReviewForm";
import { LinkifiedText } from "../../../LinkifiedText";

export const dynamic = "force-dynamic";

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return formatDateTimeIST(d);
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

  // Gated access links (community invite / download), revealed now that the
  // order is PAID. Single-product order + any cart line items; URLs sanitized.
  const accessLinks: { title: string; href: string }[] = [];
  const pushLink = (title: string | undefined, url: string | null | undefined) => {
    const href = safeUrl(url);
    if (href) accessLinks.push({ title: title || "Access link", href });
  };
  pushLink(order.product?.title, order.product?.accessUrl);
  pushLink(order.paymentPage?.title, order.paymentPage?.accessUrl);
  for (const li of order.orderItems) pushLink(li.product?.title ?? li.titleSnapshot, li.product?.accessUrl);

  // Hosted digital downloads: mint a short-lived signed URL per file (the order is
  // already PAID + buyer-scoped, so this is the trust boundary; the key is never
  // exposed). Fresh URLs each visit.
  const downloadable: { title: string; key: string }[] = [];
  if (order.product?.downloadKey) {
    downloadable.push({ title: order.product.downloadName || order.product.title, key: order.product.downloadKey });
  }
  for (const li of order.orderItems) {
    if (li.product?.downloadKey) {
      downloadable.push({
        title: li.product.downloadName || li.product.title || li.titleSnapshot,
        key: li.product.downloadKey,
      });
    }
  }
  const downloads = (
    await Promise.all(
      downloadable.map(async (d) => {
        // Ownership-scoped: the signer refuses any key outside this tenant's
        // prefix, so a seller-forged downloadKey can't serve another tenant's file.
        const href = await createSignedDownloadUrl(d.key, 3600, tenant.id);
        return href ? { title: d.title, href } : null;
      }),
    )
  ).filter((d): d is { title: string; href: string } => d !== null);

  // Verified-purchase reviews: the distinct products in this order (single-product
  // + cart lines) the buyer can rate, each prefilled with their existing review.
  const reviewable = new Map<string, { id: string; title: string }>();
  if (order.product?.id) {
    reviewable.set(order.product.id, { id: order.product.id, title: order.product.title });
  }
  for (const li of order.orderItems) {
    if (li.product?.id) {
      reviewable.set(li.product.id, {
        id: li.product.id,
        title: li.product.title ?? li.titleSnapshot,
      });
    }
  }
  const reviewableList = [...reviewable.values()];
  const existingReviews = await Promise.all(
    reviewableList.map((p) => getBuyerReviewForProduct(p.id, user.id)),
  );

  // Fulfillment timeline (physical/service orders). Digital/community orders are
  // delivered via the "Your access" card, so they skip the shipping steps.
  const FULFILL_STEPS = [
    ["NEW", "Order placed"],
    ["PROCESSING", "Processing"],
    ["SHIPPED", "Shipped"],
    ["DELIVERED", "Delivered"],
  ] as const;
  const fulfillIdx = FULFILL_STEPS.findIndex(([k]) => k === order.fulfillmentStatus);
  const cancelled = order.fulfillmentStatus === "CANCELLED";
  const showTimeline = !cancelled && accessLinks.length === 0;

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/account" className="text-sm text-cyan underline">
          ← Your orders
        </Link>
        <PrintButton />
      </div>

      {cancelled ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          This order was cancelled.
        </div>
      ) : null}

      {showTimeline ? (
        <div className="mt-6 rounded-xl border border-zinc-200 bg-surface p-5 print:hidden">
          <h2 className="text-sm font-semibold text-zinc-900">Order status</h2>
          <ol className="mt-4">
            {FULFILL_STEPS.map(([key, label], i) => {
              const done = i <= fulfillIdx;
              const current = i === fulfillIdx;
              const isLast = i === FULFILL_STEPS.length - 1;
              return (
                <li key={key} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[0.7rem] ${
                        done ? "bg-success text-white" : "border border-zinc-200 text-transparent"
                      } ${current ? "ring-2 ring-success/40" : ""}`}
                    >
                      ✓
                    </span>
                    {!isLast ? (
                      <span className={`h-7 w-px ${i < fulfillIdx ? "bg-success" : "bg-zinc-200"}`} />
                    ) : null}
                  </div>
                  <span
                    className={`pt-0.5 text-sm ${done ? "text-zinc-900" : "text-muted"} ${
                      current ? "font-medium" : ""
                    }`}
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      <div className="mt-6 rounded-xl border border-zinc-200 bg-surface p-6">
        <header className="border-b border-zinc-200 pb-4">
          <h1 className="text-lg font-bold text-zinc-900">{sellerName}</h1>
          <p className="mt-0.5 text-sm text-muted">Receipt</p>
        </header>

        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Order</dt>
            <dd className="font-mono text-zinc-700">{order.id.slice(0, 8)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Date</dt>
            <dd className="text-zinc-700">{formatDate(order.paidAt)}</dd>
          </div>
          {order.razorpayPaymentId ? (
            <div className="flex justify-between">
              <dt className="text-muted">Payment</dt>
              <dd className="font-mono text-zinc-700">{order.razorpayPaymentId}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-muted">Status</dt>
            <dd className="text-zinc-700">
              {STATUS_LABEL[order.fulfillmentStatus] ?? order.fulfillmentStatus}
            </dd>
          </div>
        </dl>

        {/* Items */}
        <div className="mt-4 border-t border-zinc-200 pt-4">
          {order.orderItems.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {order.orderItems.map((li, i) => (
                <li key={i} className="flex justify-between">
                  <span className="text-zinc-700">
                    {li.titleSnapshot} × {li.quantity}
                  </span>
                  <span className="text-zinc-700">
                    {formatRupees(li.unitPricePaise * li.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-700">
                {order.itemTitle ?? order.paymentPage?.title ?? "Order"}
              </span>
              <span className="text-zinc-700">{formatRupees(subtotal)}</span>
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="mt-4 space-y-1 border-t border-zinc-200 pt-4 text-sm">
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
          <div className="flex justify-between border-t border-zinc-200 pt-1 font-semibold text-zinc-900">
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
          <p className="mt-4 border-t border-zinc-200 pt-4 text-xs text-muted">
            <LinkifiedText text={order.trackingNote} />
          </p>
        ) : null}
      </div>

      {downloads.length > 0 ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="text-sm font-semibold text-zinc-900">Your downloads</h2>
          <p className="mt-1 text-xs text-muted">
            Thanks for your purchase — your files are ready (links refresh each visit).
          </p>
          <div className="mt-3 space-y-2">
            {downloads.map((d, i) => (
              <a
                key={i}
                href={d.href}
                className="block w-full rounded-lg bg-brand-gradient px-4 py-2.5 text-center text-sm font-medium text-white shadow-glow"
              >
                Download: {d.title} ↓
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {accessLinks.length > 0 ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="text-sm font-semibold text-zinc-900">Your access</h2>
          <p className="mt-1 text-xs text-muted">
            Thanks for your purchase — here’s your access link.
          </p>
          <div className="mt-3 space-y-2">
            {accessLinks.map((l, i) => (
              <a
                key={i}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="block w-full rounded-lg bg-brand-gradient px-4 py-2.5 text-center text-sm font-medium text-white shadow-glow"
              >
                Open: {l.title} →
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {reviewableList.length > 0 ? (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-surface p-5 print:hidden">
          <h2 className="text-sm font-semibold text-zinc-900">Rate your purchase</h2>
          <p className="mt-1 text-xs text-muted">
            Your review appears on the product page and helps other buyers (verified purchase).
          </p>
          <div className="mt-4 space-y-6">
            {reviewableList.map((pr, i) => {
              const ex = existingReviews[i];
              return (
                <ReviewForm
                  key={pr.id}
                  kind="product"
                  subjectId={pr.id}
                  subjectTitle={pr.title}
                  initial={
                    ex ? { rating: ex.rating, body: ex.body, authorName: ex.authorName } : null
                  }
                />
              );
            })}
          </div>
        </div>
      ) : null}

      <p className="mt-4 text-center text-xs text-muted">Paid to {sellerName}.</p>
    </main>
  );
}
