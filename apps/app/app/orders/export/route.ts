import { listTenantOrders, type FulfillmentStatusFilter } from "@invoxai/db";
import { paiseToRupeeString } from "@invoxai/utils/money";
import { requireTenant } from "../../../lib/tenant";
import { toCsv, csvResponse } from "../../../lib/csv";

export const dynamic = "force-dynamic";

const STATUSES: readonly FulfillmentStatusFilter[] = [
  "NEW",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

/** Seller orders export (CSV download). Tenant-scoped via the session.
 *  Honors the same status/search filter as the orders page, so "Export CSV"
 *  downloads exactly what the seller is viewing. */
export async function GET(req: Request) {
  const { tenant } = await requireTenant();
  const url = new URL(req.url);
  const rawStatus = url.searchParams.get("status");
  const status = STATUSES.includes(rawStatus as FulfillmentStatusFilter)
    ? (rawStatus as FulfillmentStatusFilter)
    : undefined;
  const search = url.searchParams.get("q")?.trim() || undefined;
  const orders = await listTenantOrders(tenant.id, { status, search, take: 10000 });

  const csv = toCsv(
    [
      "Paid at",
      "Item",
      "Buyer email",
      "Buyer phone",
      "Amount (INR)",
      "Fulfillment",
      "Refunded (INR)",
      "Commission status",
      "Commission (INR)",
      "Razorpay payment id",
    ],
    orders.map((o) => [
      o.paidAt?.toISOString() ?? "",
      o.itemTitle ?? o.paymentPage?.title ?? "",
      o.buyerEmail ?? "",
      o.buyerContact ?? "",
      paiseToRupeeString(o.amountPaise),
      o.fulfillmentStatus,
      paiseToRupeeString(o.refundedPaise),
      o.commission?.status ?? "",
      o.commission ? paiseToRupeeString(o.commission.amountPaise) : "",
      o.razorpayPaymentId ?? "",
    ]),
  );

  return csvResponse(`invoxai-orders-${tenant.username}.csv`, csv);
}
