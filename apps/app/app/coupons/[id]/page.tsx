import { notFound } from "next/navigation";
import { getCouponById } from "@invoxai/db";
import { requireTenant } from "../../../lib/tenant";
import { CouponForm } from "../CouponForm";
import { updateCouponAction } from "../actions";

export const dynamic = "force-dynamic";

// A stored Date → the "YYYY-MM-DDTHH:mm" value a datetime-local input expects.
// We format UTC components so it round-trips through `new Date()` on submit
// (the VPS runs in UTC, so local == UTC — see actions.parseDate).
function toLocalInput(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 16) : null;
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

  const action = updateCouponAction.bind(null, coupon.id);

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <h1 className="text-2xl font-bold">Edit coupon</h1>
      <p className="mt-1 font-mono text-muted">{coupon.code}</p>
      <div className="mt-6">
        <CouponForm
          action={action}
          submitLabel="Save changes"
          initial={{
            code: coupon.code,
            type: coupon.type,
            value: coupon.value,
            minSubtotalPaise: coupon.minSubtotalPaise,
            maxRedemptions: coupon.maxRedemptions,
            startsAt: toLocalInput(coupon.startsAt),
            expiresAt: toLocalInput(coupon.expiresAt),
          }}
        />
      </div>
    </div>
  );
}
