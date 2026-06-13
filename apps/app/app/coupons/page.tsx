import {formatDateIST} from "@invoxai/utils/date";
import Link from "next/link";
import { Button, GlassCard, PageHeader, Pagination, pageSlice } from "@invoxai/ui";
import { listCoupons, countCoupons, getSellerGateway } from "@invoxai/db";
import { formatRupees, bpsToPercentString } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";
import { setCouponActiveAction, deleteCouponAction } from "./actions";
import { CopyCouponLink } from "./CopyCouponLink";

export const dynamic = "force-dynamic";

function discountLabel(type: string, value: number): string {
  return type === "PERCENT" ? `${bpsToPercentString(value)}% off` : `${formatRupees(value)} off`;
}

function windowLabel(startsAt: Date | null, expiresAt: Date | null): string | null {
  const fmt = (d: Date) =>
    formatDateIST(d);
  if (startsAt && expiresAt) return `${fmt(startsAt)} – ${fmt(expiresAt)}`;
  if (expiresAt) return `Until ${fmt(expiresAt)}`;
  if (startsAt) return `From ${fmt(startsAt)}`;
  return null;
}

export default async function CouponsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; size?: string }>;
}) {
  const { tenant } = await requireTenant();
  const { page: rawPage, size: rawSize } = await searchParams;
  const total = await countCoupons(tenant.id);
  const { page, totalPages, skip, take, pageSize } = pageSlice(total, rawPage, rawSize);
  const [coupons, gateway] = await Promise.all([
    listCoupons(tenant.id, { skip, take }),
    getSellerGateway(tenant.id),
  ]);
  const firstOnPage = total === 0 ? 0 : skip + 1;
  const lastOnPage = skip + coupons.length;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · store"
        title="Coupons"
        actions={
          gateway ? (
            <Button href="/coupons/new" size="sm">
              New coupon
            </Button>
          ) : null
        }
      />

      {!gateway ? (
        <div>
          <GlassCard title="Connect a gateway first">
            <p className="text-sm text-muted">
              Coupons discount your store sales, which run on your own Razorpay
              account. Connect it before creating codes.
            </p>
            <Link
              href="/gateway"
              className="mt-3 inline-block text-sm font-medium text-brand-strong underline"
            >
              Connect gateway →
            </Link>
          </GlassCard>
        </div>
      ) : coupons.length === 0 ? (
        <GlassCard>
          <p className="text-muted">
            No coupons yet. Create a discount code for your store.
          </p>
        </GlassCard>
      ) : (
        <GlassCard className="divide-y divide-zinc-100 p-0">
          {coupons.map((c) => {
            const win = windowLabel(c.startsAt, c.expiresAt);
            const usage =
              c.maxRedemptions === null
                ? `${c.redeemedCount} used`
                : `${c.redeemedCount} / ${c.maxRedemptions} used`;
            return (
              <div key={c.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-zinc-900">{c.code}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.isActive ? "bg-green-50 text-green-700" : "bg-zinc-100 text-muted"
                        }`}
                      >
                        {c.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <span className="mt-1 block text-sm text-zinc-700">
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
                      <CopyCouponLink
                        url={`https://${tenant.username}.invoxai.io/store?coupon=${encodeURIComponent(c.code)}`}
                      />
                      <Link href={`/coupons/${c.id}`} className="text-brand-strong underline">
                        Edit
                      </Link>
                      {c.isActive ? (
                        <form action={setCouponActiveAction.bind(null, c.id, false)}>
                          <button className="text-muted underline hover:text-zinc-900">
                            Deactivate
                          </button>
                        </form>
                      ) : (
                        <form action={setCouponActiveAction.bind(null, c.id, true)}>
                          <button className="text-muted underline hover:text-zinc-900">
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
        </GlassCard>
      )}
      {gateway && total > 0 ? (
        <Pagination
          page={page}
          totalPages={totalPages}
          firstOnPage={firstOnPage}
          lastOnPage={lastOnPage}
          total={total}
          pageSize={pageSize}
          label="coupons"
        />
      ) : null}
    </div>
  );
}
