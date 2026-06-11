import { listTenantOrders } from "@invoxai/db";
import { paiseToRupeeString } from "@invoxai/utils/money";
import { requireTenant } from "../../../lib/tenant";
import { toCsv, csvResponse } from "../../../lib/csv";

export const dynamic = "force-dynamic";

/** Seller orders export (CSV download). Tenant-scoped via the session. */
export async function GET() {
  const { tenant } = await requireTenant();
  const orders = await listTenantOrders(tenant.id, 10000);

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
      o.paymentPage.title,
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
