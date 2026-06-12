import { notFound } from "next/navigation";
import { GlassCard, PageHeader } from "@invoxai/ui";
import { getPlanById } from "@invoxai/db";
import { requireAdmin } from "../../../lib/auth";
import { AdminShell } from "../../components/AdminShell";
import { NotAuthorized } from "../../components/NotAuthorized";
import { PlanForm } from "../PlanForm";
import { updatePlanAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const gate = await requireAdmin();
  if (!gate.ok) return <NotAuthorized email={gate.user.email} />;

  const { id } = await params;
  const plan = await getPlanById(id);
  if (!plan) notFound();

  // Bind the plan id into the update action so the form keeps the (prev, form)
  // shape useActionState expects.
  const action = updatePlanAction.bind(null, plan.id);

  return (
    <AdminShell email={gate.user.email}>
      <PageHeader eyebrow="InvoxAI · admin" title="Edit plan" description={plan.name} />
      <GlassCard className="max-w-xl">
        <PlanForm
          action={action}
          submitLabel="Save changes"
          initial={{
            key: plan.key,
            name: plan.name,
            description: plan.description,
            priceMonthly: plan.priceMonthly,
            priceYearly: plan.priceYearly,
            commissionBps: plan.commissionBps,
            maxProducts: plan.maxProducts,
            maxAiPages: plan.maxAiPages,
            customDomainAllowed: plan.customDomainAllowed,
            sortOrder: plan.sortOrder,
          }}
        />
      </GlassCard>
    </AdminShell>
  );
}
