import { notFound } from "next/navigation";
import { GlassCard, PageHeader } from "@invoxai/ui";
import { getUpsellById, listProductOptionsForUpsell } from "@invoxai/db";
import { requireTenant } from "../../../lib/tenant";
import { UpsellForm } from "../UpsellForm";
import { updateUpsellAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditUpsellPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenant } = await requireTenant();
  const { id } = await params;
  const [upsell, products] = await Promise.all([
    getUpsellById(tenant.id, id),
    listProductOptionsForUpsell(tenant.id),
  ]);
  if (!upsell) notFound();

  const action = updateUpsellAction.bind(null, upsell.id);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="InvoxAI · growth" title="Edit upsell" />
      <GlassCard>
        <UpsellForm
          action={action}
          products={products}
          initial={{
            offerProductId: upsell.offerProductId,
            triggerProductId: upsell.triggerProductId,
            headline: upsell.headline,
            blurb: upsell.blurb,
            discountBps: upsell.discountBps,
          }}
          submitLabel="Save changes"
        />
      </GlassCard>
    </div>
  );
}
