"use server";

import { revalidatePath } from "next/cache";
import { updateOrderFulfillment } from "@invoxai/db";
import { requireTenant } from "../../lib/tenant";

const STATUSES = ["NEW", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] as const;
type Status = (typeof STATUSES)[number];

/**
 * Update an order's fulfillment status + tracking note. Scoped to the seller's
 * own tenant (the DB write filters by tenantId, so a forged id can't touch
 * another seller's order). Used as a form action — bound to the order id.
 */
export async function updateOrderFulfillmentAction(id: string, form: FormData) {
  const { tenant } = await requireTenant();

  const raw = String(form.get("status") ?? "");
  const status = (STATUSES as readonly string[]).includes(raw)
    ? (raw as Status)
    : "NEW";
  const note = String(form.get("note") ?? "").trim() || null;

  await updateOrderFulfillment(tenant.id, id, status, note);
  revalidatePath("/orders");
}
