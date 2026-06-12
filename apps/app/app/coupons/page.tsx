import Link from "next/link";
import { Card } from "@invoxai/ui";
import { listCoupons, getSellerGateway } from "@invoxai/db";
import { formatRupees, bpsToPercentString } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";
import { setCouponActiveAction, deleteCouponAction } from "./actions";

export const dynamic = "force-dynamic";

function discountLabel(type: string, value: number): string {
  return type === "PERCENT" ? `${bpsToPercentString(value)}% off` : `${formatRupees(value)} off`;
}

function windowLabel(startsAt: Date | null, expiresAt: Date | null): string | null {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  if (startsAt && expiresAt) return `${fmt(startsAt)} – ${fmt(expiresAt)}`;
  if (expiresAt) return `Until ${fmt(expiresAt)}`;
  if (startsAt) return `From ${fmt(startsAt)}`;
  return null;
}

export default async function CouponsPage() {
  const { tenant } = await requireTenant();
  const [coupons, gateway] = await Promise.all([
    listCoupons(tenant.id),
    getSellerGateway(tenant.id),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-neutral-400">
            InvoxAI · store
          </p>
          <h1 className="mt-1 text-3xl font-bold">Coupons</h1>
        </div>
        {gateway ? (
          <Link
            href="/coupons/new"
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
          >
            New coupon
          </Link>
        ) : null}
      </div>

      {!gateway ? (
        <div className="mt-8">
          <Card title="Connect a gateway first">
            <p className="text-sm text-neutral-500">
              Coupons discount your store sales, which run on your own Razorpay
              account. Connect it before creating codes.
            </p>
            <Link
              href="/gateway"
              className="mt-3 inline-block text-sm font-medium text-blue-600 underline"
            >
              Connect gateway →
            </Link>
          </Card>
        </div>
      ) : coupons.length === 0 ? (
        <p className="mt-8 text-neutral-500">
          No coupons yet. Create a discount code for your store.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {coupons.map((c) => {
            const win = windowLabel(c.startsAt, c.expiresAt);
            const usage =
              c.maxRedemptions === null
                ? `${c.redeemedCount} used`
                : `${c.redeemedCount} / ${c.maxRedemptions} used`;
            return (
              <div key={c.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-neutral-900">{c.code}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.isActive ? "bg-green-50 text-green-700" : "bg-neutral-100 text-neutral-500"
                        }`}
                      >
                        {c.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <span className="mt-1 block text-sm text-neutral-700">
                      {discountLabel(c.type, c.value)}
                      {c.minSubtotalPaise != null
                        ? ` · min ${formatRupees(c.minSubtotalPaise)}`
                        : ""}
                    </span>
                    <span className="mt-1 block text-xs text-neutral-400">
                      {usage}
                      {win ? ` · ${win}` : ""}
                    </span>
                  </div>
                  <div className="shrink-0 text-right text-sm">
                    <div className="flex items-center gap-3">
                      <Link href={`/coupons/${c.id}`} className="text-blue-600 underline">
                        Edit
                      </Link>
                      {c.isActive ? (
                        <form action={setCouponActiveAction.bind(null, c.id, false)}>
                          <button className="text-neutral-500 underline hover:text-neutral-900">
                            Deactivate
                          </button>
                        </form>
                      ) : (
                        <form action={setCouponActiveAction.bind(null, c.id, true)}>
                          <button className="text-neutral-500 underline hover:text-neutral-900">
                            Activate
                          </button>
                        </form>
                      )}
                      <form action={deleteCouponAction.bind(null, c.id)}>
                        <button className="text-neutral-400 underline hover:text-red-700">
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
