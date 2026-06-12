import Link from "next/link";
import { GlassCard } from "@invoxai/ui";
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
    d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
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
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted">
            InvoxAI · store
          </p>
          <h1 className="mt-1 text-3xl font-bold">Coupons</h1>
        </div>
        {gateway ? (
          <Link
            href="/coupons/new"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white"
          >
            New coupon
          </Link>
        ) : null}
      </div>

      {!gateway ? (
        <div className="mt-8">
          <GlassCard title="Connect a gateway first">
            <p className="text-sm text-muted">
              Coupons discount your store sales, which run on your own Razorpay
              account. Connect it before creating codes.
            </p>
            <Link
              href="/gateway"
              className="mt-3 inline-block text-sm font-medium text-cyan underline"
            >
              Connect gateway →
            </Link>
          </GlassCard>
        </div>
      ) : coupons.length === 0 ? (
        <p className="mt-8 text-muted">
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
              <div key={c.id} className="rounded-xl border border-white/10 bg-surface p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-white">{c.code}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.isActive ? "bg-green-50 text-green-700" : "bg-white/10 text-muted"
                        }`}
                      >
                        {c.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <span className="mt-1 block text-sm text-neutral-200">
                      {discountLabel(c.type, c.value)}
                      {c.minSubtotalPaise != null
                        ? ` · min ${formatRupees(c.minSubtotalPaise)}`
                        : ""}
                    </span>
                    <span className="mt-1 block text-xs text-muted">
                      {usage}
                      {win ? ` · ${win}` : ""}
                    </span>
                  </div>
                  <div className="shrink-0 text-right text-sm">
                    <div className="flex items-center gap-3">
                      <Link href={`/coupons/${c.id}`} className="text-cyan underline">
                        Edit
                      </Link>
                      {c.isActive ? (
                        <form action={setCouponActiveAction.bind(null, c.id, false)}>
                          <button className="text-muted underline hover:text-white">
                            Deactivate
                          </button>
                        </form>
                      ) : (
                        <form action={setCouponActiveAction.bind(null, c.id, true)}>
                          <button className="text-muted underline hover:text-white">
                            Activate
                          </button>
                        </form>
                      )}
                      <form action={deleteCouponAction.bind(null, c.id)}>
                        <button className="text-muted underline hover:text-red-700">
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
    </div>
  );
}
