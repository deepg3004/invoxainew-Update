import { GlassCard, PageHeader } from "@invoxai/ui";
import { requireAdmin } from "../../../lib/auth";
import { AdminShell } from "../../components/AdminShell";
import { NotAuthorized } from "../../components/NotAuthorized";
import { PlanForm } from "../PlanForm";
import { createPlanAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewPlanPage() {
  const gate = await requireAdmin();
  if (!gate.ok) return <NotAuthorized email={gate.user.email} />;

  return (
    <AdminShell email={gate.user.email}>
      <PageHeader
        eyebrow="InvoxAI · admin"
        title="New plan"
        description="Define a subscription tier. Prices and commission are editable later; the key is permanent."
      />
      <div className="max-w-xl">
        <GlassCard>
          <PlanForm action={createPlanAction} submitLabel="Create plan" />
        </GlassCard>
      </div>
    </AdminShell>
  );
}
