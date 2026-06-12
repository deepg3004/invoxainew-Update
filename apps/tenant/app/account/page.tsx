import {formatDateIST} from "@invoxai/utils/date";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { GlassCard } from "@invoxai/ui";
import { formatRupees } from "@invoxai/utils/money";
import {
  upsertProfile,
  ensureBuyerAccount,
  listBuyerOrders,
  listEnrolledCourses,
} from "@invoxai/db";
import { getSessionUser } from "../../lib/auth";
import { resolveTenantByHost } from "../../lib/resolve";
import { LinkifiedText } from "../LinkifiedText";

export const dynamic = "force-dynamic";

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return formatDateIST(d);
}

export default async function BuyerCorner() {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
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

  const [orders, courses] = await Promise.all([
    listBuyerOrders({
      tenantId: tenant.id,
      profileId: user.id,
      email: user.email ?? null,
    }),
    listEnrolledCourses({
      tenantId: tenant.id,
      profileId: user.id,
      email: user.email ?? null,
    }),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted">
            {tenant.name ?? tenant.username}
          </p>
          <h1 className="mt-1 text-3xl font-bold">Your orders</h1>
          <p className="mt-1 text-sm text-muted">Signed in as {user.email}</p>
        </div>
        <form action="/account/auth/signout" method="post">
          <button className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50">
            Sign out
          </button>
        </form>
      </div>

      {courses.length > 0 ? (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Your courses
          </h2>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {courses.map((c) => (
              <Link
                key={c.id}
                href={`/account/learn/${c.slug}`}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-surface p-3 transition hover:border-brand/40"
              >
                {c.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.imageUrl}
                    alt={c.title}
                    className="h-12 w-12 rounded-lg border border-zinc-200 object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-lg bg-zinc-50" />
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.title}</span>
                <span className="text-xs text-cyan">Open →</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-8">
        {orders.length === 0 ? (
          <GlassCard title="No orders yet">
            <p className="text-sm text-muted">
              Payments you make on this store will appear here.
            </p>
          </GlassCard>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-zinc-200 last:border-0">
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      {o.itemTitle ?? o.paymentPage?.title ?? "Order"}
                      {o.quantity > 1 ? ` ×${o.quantity}` : ""}
                      {o.orderItems.length > 0 ? (
                        <ul className="mt-1 text-xs font-normal text-muted">
                          {o.orderItems.map((li, idx) => (
                            <li key={idx}>
                              {li.titleSnapshot} ×{li.quantity}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <Link
                        href={`/account/orders/${o.id}`}
                        className="mt-1 block text-xs font-normal text-cyan underline"
                      >
                        View receipt →
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{formatDate(o.paidAt)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                        {o.fulfillmentStatus.charAt(0) +
                          o.fulfillmentStatus.slice(1).toLowerCase()}
                      </span>
                      {o.trackingNote ? (
                        <div className="mt-1 text-xs text-muted">
                          <LinkifiedText text={o.trackingNote} />
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatRupees(o.amountPaise)}
                      {o.discountPaise > 0 ? (
                        <div className="text-xs font-medium text-green-700">
                          {o.couponCode ? `${o.couponCode}: ` : ""}−{formatRupees(o.discountPaise)}
                        </div>
                      ) : null}
                      {o.refundedPaise > 0 ? (
                        <div className="text-xs font-medium text-red-700">
                          −{formatRupees(o.refundedPaise)} refunded
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-6 text-sm">
        <Link href="/" className="text-cyan underline">
          ← Back to {tenant.name ?? tenant.username}
        </Link>
      </p>
    </main>
  );
}
