import { GlassCard, PageHeader } from "@invoxai/ui";
import { listProducts } from "@invoxai/db";
import { requireTenant } from "../../../lib/tenant";
import { CouponForm } from "../CouponForm";
import { createCouponAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewCouponPage() {
  const { tenant } = await requireTenant();
  const products = (await listProducts(tenant.id)).map((p) => ({ id: p.id, title: p.title }));
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · store"
        title="New coupon"
        description="Buyers enter this code at checkout. The discount applies to your store sales; your InvoxAI commission is taken on the discounted total."
      />
      <GlassCard>
        <CouponForm action={createCouponAction} submitLabel="Create coupon" products={products} />
      </GlassCard>
    </div>
  );
}
