import { notFound } from "next/navigation";
import { GlassCard, PageHeader } from "@invoxai/ui";
import { getSequenceWithSteps, listProductOptionsForSequence } from "@invoxai/db";
import { requireTenant } from "../../../lib/tenant";
import { SequenceForm } from "../SequenceForm";
import { AddStepForm } from "../AddStepForm";
import {
  updateSequenceAction,
  deleteSequenceAction,
  addStepAction,
  deleteStepAction,
} from "../actions";

export const dynamic = "force-dynamic";

function delayLabel(hours: number): string {
  if (hours === 0) return "Immediately";
  if (hours < 24) return `After ${hours}h`;
  const days = Math.round(hours / 24);
  return `After ${days} day${days === 1 ? "" : "s"}`;
}

export default async function EditSequencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenant } = await requireTenant();
  const { id } = await params;
  const [sequence, products] = await Promise.all([
    getSequenceWithSteps(tenant.id, id),
    listProductOptionsForSequence(tenant.id),
  ]);
  if (!sequence) notFound();

  const updateAction = updateSequenceAction.bind(null, sequence.id);
  const addAction = addStepAction.bind(null, sequence.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader eyebrow="InvoxAI · growth" title={sequence.name} />

      <GlassCard title="Settings">
        <SequenceForm
          action={updateAction}
          products={products}
          initial={{
            name: sequence.name,
            trigger: sequence.trigger,
            triggerProductId: sequence.triggerProductId,
          }}
          submitLabel="Save settings"
        />
      </GlassCard>

      <GlassCard title="Steps">
        {sequence.steps.length === 0 ? (
          <p className="text-sm text-muted">No steps yet. Add the first one below.</p>
        ) : (
          <ol className="space-y-3">
            {sequence.steps.map((step, idx) => (
              <li key={step.id} className="rounded-lg border border-zinc-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-medium uppercase tracking-wide text-brand-strong">
                      Step {idx + 1} · {delayLabel(step.delayHours)}
                    </div>
                    {step.subject ? (
                      <div className="mt-1 font-medium text-zinc-900">{step.subject}</div>
                    ) : null}
                    <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">{step.body}</p>
                  </div>
                  <form action={deleteStepAction.bind(null, sequence.id, step.id)}>
                    <button className="shrink-0 text-sm text-muted underline hover:text-red-700">
                      Delete
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="mt-5 border-t border-zinc-100 pt-5">
          <h3 className="mb-3 text-sm font-semibold text-zinc-900">Add a step</h3>
          <AddStepForm action={addAction} />
        </div>
      </GlassCard>

      <GlassCard title="Danger zone">
        <form action={deleteSequenceAction.bind(null, sequence.id)}>
          <button className="text-sm text-red-700 underline">Delete this sequence</button>
        </form>
      </GlassCard>
    </div>
  );
}
