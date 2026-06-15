import { notFound } from "next/navigation";
import { GlassCard, PageHeader } from "@invoxai/ui";
import { getCouponById, listProducts } from "@invoxai/db";
import { requireTenant } from "../../../lib/tenant";
import { CouponForm } from "../CouponForm";
import { updateCouponAction } from "../actions";

export const dynamic = "force-dynamic";

// A stored Date → the "YYYY-MM-DDTHH:mm" value a datetime-local input expects,
// in IST wall-clock so the seller sets coupon windows in IST (actions.parseDate
// re-pins the same offset on submit).
function toLocalInput(d: Date | null): string | null {
  if (!d) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hh = g("hour") === "24" ? "00" : g("hour"); // some ICU emit 24 at midnight
  return `${g("year")}-${g("month")}-${g("day")}T${hh}:${g("minute")}`;
}

export default async function EditCouponPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenant } = await requireTenant();
  const { id } = await params;
  const coupon = await getCouponById(tenant.id, id);
  if (!coupon) notFound();
  const products = (await listProducts(tenant.id)).map((p) => ({ id: p.id, title: p.title }));

  const action = updateCouponAction.bind(null, coupon.id);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · coupons"
        title="Edit coupon"
        description={<span className="font-mono">{coupon.code}</span>}
      />
      <GlassCard>
        <CouponForm
          action={action}
          submitLabel="Save changes"
          products={products}
          initial={{
            code: coupon.code,
            type: coupon.type,
            value: coupon.value,
            minSubtotalPaise: coupon.minSubtotalPaise,
            maxRedemptions: coupon.maxRedemptions,
            perCustomerLimit: coupon.perCustomerLimit,
            firstOrderOnly: coupon.firstOrderOnly,
            productId: coupon.productId,
            startsAt: toLocalInput(coupon.startsAt),
            expiresAt: toLocalInput(coupon.expiresAt),
          }}
        />
      </GlassCard>
    </div>
  );
}
