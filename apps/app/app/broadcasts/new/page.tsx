import { GlassCard, PageHeader } from "@invoxai/ui";
import { segmentCounts } from "@invoxai/db";
import { requireTenant } from "../../../lib/tenant";
import { BroadcastForm } from "../BroadcastForm";
import { createBroadcastAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewBroadcastPage() {
  const { tenant } = await requireTenant();
  const counts = await segmentCounts(tenant.id);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="InvoxAI · growth"
        title="New broadcast"
        description="Compose your email and pick who gets it. You can review before sending."
      />
      <GlassCard>
        <BroadcastForm action={createBroadcastAction} counts={counts} submitLabel="Save draft" />
      </GlassCard>
    </div>
  );
}
