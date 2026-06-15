import Link from "next/link";
import { GlassCard, PageHeader } from "@invoxai/ui";
import { listProductOptionsForUpsell } from "@invoxai/db";
import { requireTenant } from "../../../lib/tenant";
import { UpsellForm } from "../UpsellForm";
import { createUpsellAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewUpsellPage() {
  const { tenant } = await requireTenant();
  const products = await listProductOptionsForUpsell(tenant.id);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · growth"
        title="New upsell"
        description="After a buyer pays, pitch one more product at a one-click offer. It charges on your own gateway; your InvoxAI commission is taken on the offer total."
      />
      <GlassCard>
        {products.length === 0 ? (
          <p className="text-sm text-muted">
            You need at least one published product to offer.{" "}
            <Link href="/products/new" className="text-brand-strong underline">
              Add a product →
            </Link>
          </p>
        ) : (
          <UpsellForm action={createUpsellAction} products={products} submitLabel="Create upsell" />
        )}
      </GlassCard>
    </div>
  );
}
