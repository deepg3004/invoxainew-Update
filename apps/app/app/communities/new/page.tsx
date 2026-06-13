import { GlassCard, PageHeader } from "@invoxai/ui";
import { requireTenant } from "../../../lib/tenant";
import { CommunityForm } from "../CommunityForm";
import { createCommunityAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewCommunityPage() {
  await requireTenant();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · communities"
        title="New community"
        description="A free or paid members space. Paid communities settle to your own gateway."
      />
      <GlassCard className="mt-6">
        <CommunityForm action={createCommunityAction} submitLabel="Create community" />
      </GlassCard>
    </div>
  );
}
