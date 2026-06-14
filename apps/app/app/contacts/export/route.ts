import { listContacts } from "@invoxai/db";
import { paiseToRupeeString } from "@invoxai/utils/money";
import { requireTenant } from "../../../lib/tenant";
import { toCsv, csvResponse } from "../../../lib/csv";

export const dynamic = "force-dynamic";

/** Seller contacts export (CSV download). Tenant-scoped via the session. Honors
 *  the same `q` search as the contacts page, so the download matches the view. */
export async function GET(req: Request) {
  const { tenant } = await requireTenant();
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim().toLowerCase() || "";

  let contacts = await listContacts(tenant.id);
  if (q) {
    contacts = contacts.filter(
      (c) =>
        c.email.toLowerCase().includes(q) ||
        (c.name?.toLowerCase().includes(q) ?? false) ||
        (c.phone?.toLowerCase().includes(q) ?? false),
    );
  }

  const csv = toCsv(
    [
      "Name",
      "Email",
      "Phone",
      "Type",
      "Orders started",
      "Paid orders",
      "Total spent (INR)",
      "First seen",
      "Last seen",
    ],
    contacts.map((c) => [
      c.name ?? "",
      c.email,
      c.phone ?? "",
      c.isBuyer ? "Buyer" : "Lead",
      String(c.orderCount),
      String(c.paidCount),
      paiseToRupeeString(c.totalSpentPaise),
      c.firstSeen.toISOString(),
      c.lastSeen.toISOString(),
    ]),
  );

  return csvResponse(`invoxai-contacts-${tenant.username}.csv`, csv);
}
