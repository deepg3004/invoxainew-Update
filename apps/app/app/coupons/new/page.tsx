import { requireTenant } from "../../../lib/tenant";
import { CouponForm } from "../CouponForm";
import { createCouponAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewCouponPage() {
  await requireTenant();
  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <h1 className="text-2xl font-bold">New coupon</h1>
      <p className="mt-1 text-neutral-500">
        Buyers enter this code at checkout. The discount applies to your store
        sales; your InvoxAI commission is taken on the discounted total.
      </p>
      <div className="mt-6">
        <CouponForm action={createCouponAction} submitLabel="Create coupon" />
      </div>
    </main>
  );
}
