import { GlassCard, PageHeader } from "@invoxai/ui";
import { requireTenant } from "../../../lib/tenant";
import { ProductForm } from "../ProductForm";
import { createProductAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  await requireTenant();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · store"
        title="New product"
        description="Add an item to your store. Buyers pay you directly on your own gateway."
      />
      <GlassCard>
        <ProductForm action={createProductAction} submitLabel="Create product" />
      </GlassCard>
    </div>
  );
}
