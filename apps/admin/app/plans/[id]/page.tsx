import { notFound } from "next/navigation";
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
      <h1 className="text-2xl font-bold">Edit plan</h1>
      <p className="mt-1 text-neutral-500">{plan.name}</p>
      <div className="mt-6 max-w-xl">
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
      </div>
    </AdminShell>
  );
}
