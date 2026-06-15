import { GlassCard, PageHeader } from "@invoxai/ui";
import { requireTenant } from "../../../lib/tenant";
import { WorkshopForm } from "../WorkshopForm";
import { createWorkshopAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewWorkshopPage() {
  await requireTenant();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · workshops"
        title="New workshop"
        description="Set up a live session. Add the join link now or later — it's only shown to people who register."
      />
      <GlassCard>
        <WorkshopForm action={createWorkshopAction} submitLabel="Create workshop" />
      </GlassCard>
    </div>
  );
}
