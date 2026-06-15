import Link from "next/link";
import { Button, GlassCard, PageHeader, Pagination, pageSlice } from "@invoxai/ui";
import { listUpsells, countUpsells, getSellerGateway } from "@invoxai/db";
import { formatRupees, bpsToPercentString } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";
import { setUpsellActiveAction, deleteUpsellAction } from "./actions";

export const dynamic = "force-dynamic";

function offerPricePaise(pricePaise: number, discountBps: number): number {
  return Math.max(0, pricePaise - Math.floor((pricePaise * discountBps) / 10000));
}

export default async function UpsellsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; size?: string }>;
}) {
  const { tenant } = await requireTenant();
  const { page: rawPage, size: rawSize } = await searchParams;
  const total = await countUpsells(tenant.id);
  const { page, totalPages, skip, take, pageSize } = pageSlice(total, rawPage, rawSize);
  const [upsells, gateway] = await Promise.all([
    listUpsells(tenant.id, { skip, take }),
    getSellerGateway(tenant.id),
  ]);
  const firstOnPage = total === 0 ? 0 : skip + 1;
  const lastOnPage = skip + upsells.length;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · growth"
        title="Upsells"
        description="Offer one more product right after a buyer pays — a one-click one-time offer on your own gateway."
        actions={
          gateway ? (
            <Button href="/upsells/new" size="sm">
              New upsell
            </Button>
          ) : null
        }
      />

      {!gateway ? (
        <GlassCard title="Connect a gateway first">
          <p className="text-sm text-muted">
            Upsells are charged on your own Razorpay account, just like your other
            sales. Connect it before creating offers.
          </p>
          <Link
            href="/gateway"
            className="mt-3 inline-block text-sm font-medium text-brand-strong underline"
          >
            Connect gateway →
          </Link>
        </GlassCard>
      ) : upsells.length === 0 ? (
        <GlassCard>
          <p className="text-muted">
            No upsells yet. Create a post-purchase offer to lift your average order value.
          </p>
        </GlassCard>
      ) : (
        <GlassCard className="divide-y divide-zinc-100 p-0">
          {upsells.map((u) => {
            const price = offerPricePaise(u.offerProduct.pricePaise, u.discountBps);
            return (
              <div key={u.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-zinc-900">{u.headline}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.active ? "bg-green-50 text-green-700" : "bg-zinc-100 text-muted"
                        }`}
                      >
                        {u.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <span className="mt-1 block text-sm text-zinc-700">
                      Offer: {u.offerProduct.title} · {formatRupees(price)}
                      {u.discountBps > 0
                        ? ` (${bpsToPercentString(u.discountBps)}% off ${formatRupees(u.offerProduct.pricePaise)})`
                        : ""}
                    </span>
                    <span className="mt-1 block text-xs text-muted">
                      {u.triggerProduct
                        ? `Shown after buying: ${u.triggerProduct.title}`
                        : "Shown after any purchase"}
                    </span>
                  </div>
                  <div className="shrink-0 text-right text-sm">
                    <div className="flex items-center gap-3">
                      <Link href={`/upsells/${u.id}`} className="text-brand-strong underline">
                        Edit
                      </Link>
                      {u.active ? (
                        <form action={setUpsellActiveAction.bind(null, u.id, false)}>
                          <button className="text-muted underline hover:text-zinc-900">
                            Deactivate
                          </button>
                        </form>
                      ) : (
                        <form action={setUpsellActiveAction.bind(null, u.id, true)}>
                          <button className="text-muted underline hover:text-zinc-900">
                            Activate
                          </button>
                        </form>
                      )}
                      <form action={deleteUpsellAction.bind(null, u.id)}>
                        <button className="text-muted underline hover:text-red-700">Delete</button>
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
          label="upsells"
        />
      ) : null}
    </div>
  );
}
