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
      <h1 className="text-2xl font-bold">New plan</h1>
      <p className="mt-1 text-neutral-500">
        Define a subscription tier. Prices and commission are editable later;
        the key is permanent.
      </p>
      <div className="mt-6 max-w-xl">
        <PlanForm action={createPlanAction} submitLabel="Create plan" />
      </div>
    </AdminShell>
  );
}
