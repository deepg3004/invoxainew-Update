import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@invoxai/ui";
import { tenantUsernameFromHost } from "@invoxai/utils/host";
import { formatRupees } from "@invoxai/utils/money";
import {
  getTenantByUsername,
  upsertProfile,
  ensureBuyerAccount,
  listBuyerOrders,
} from "@invoxai/db";
import { getSessionUser } from "../../lib/auth";

export const dynamic = "force-dynamic";

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export default async function BuyerCorner() {
  const host = (await headers()).get("host");
  const username = tenantUsernameFromHost(host);
  if (!username) notFound();
  const tenant = await getTenantByUsername(username);
  if (!tenant) notFound();

  const user = await getSessionUser();
  if (!user) redirect("/account/login");

  // First-visit setup: mirror the profile and link this buyer to this tenant.
  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null;
  await upsertProfile({ id: user.id, email: user.email ?? null, fullName });
  await ensureBuyerAccount(tenant.id, user.id);

  const orders = await listBuyerOrders({
    tenantId: tenant.id,
    profileId: user.id,
    email: user.email ?? null,
  });

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-neutral-400">
            {tenant.name ?? tenant.username}
          </p>
          <h1 className="mt-1 text-3xl font-bold">Your orders</h1>
          <p className="mt-1 text-sm text-neutral-500">Signed in as {user.email}</p>
        </div>
        <form action="/account/auth/signout" method="post">
          <button className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50">
            Sign out
          </button>
        </form>
      </div>

      <div className="mt-8">
        {orders.length === 0 ? (
          <Card title="No orders yet">
            <p className="text-sm text-neutral-500">
              Payments you make on this store will appear here.
            </p>
          </Card>
        ) : (
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-neutral-900">
                      {o.paymentPage.title}
                    </td>
                    <td className="px-4 py-3 text-neutral-500">{formatDate(o.paidAt)}</td>
                    <td className="px-4 py-3 text-right">{formatRupees(o.amountPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-6 text-sm">
        <Link href="/" className="text-blue-600 underline">
          ← Back to {tenant.name ?? tenant.username}
        </Link>
      </p>
    </main>
  );
}
