import { GlassCard, PageHeader } from "@invoxai/ui";
import { listProductOptionsForSequence } from "@invoxai/db";
import { requireTenant } from "../../../lib/tenant";
import { SequenceForm } from "../SequenceForm";
import { createSequenceAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewSequencePage() {
  const { tenant } = await requireTenant();
  const products = await listProductOptionsForSequence(tenant.id);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · growth"
        title="New sequence"
        description="Name it and choose what starts it. You'll add the timed steps next."
      />
      <GlassCard>
        <SequenceForm action={createSequenceAction} products={products} submitLabel="Create & add steps" />
      </GlassCard>
    </div>
  );
}
