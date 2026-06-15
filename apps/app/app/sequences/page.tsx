import Link from "next/link";
import { Button, GlassCard, PageHeader } from "@invoxai/ui";
import { listSequences } from "@invoxai/db";
import { requireTenant } from "../../lib/tenant";
import { setSequenceActiveAction } from "./actions";

export const dynamic = "force-dynamic";

const TRIGGER_LABEL: Record<string, string> = {
  PURCHASE: "After purchase",
  LEAD: "After lead",
  MANUAL: "Manual",
};

export default async function SequencesPage() {
  const { tenant } = await requireTenant();
  const sequences = await listSequences(tenant.id);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · growth"
        title="Sequences"
        description="Automated email follow-ups. Pick a trigger, add timed steps, and contacts are nudged automatically."
        actions={
          <Button href="/sequences/new" size="sm">
            New sequence
          </Button>
        }
      />

      {sequences.length === 0 ? (
        <GlassCard>
          <p className="text-muted">
            No sequences yet. Create one to follow up with buyers or leads automatically.
          </p>
        </GlassCard>
      ) : (
        <GlassCard className="divide-y divide-zinc-100 p-0">
          {sequences.map((s) => (
            <div key={s.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-900">{s.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.active ? "bg-green-50 text-green-700" : "bg-zinc-100 text-muted"
                      }`}
                    >
                      {s.active ? "Active" : "Paused"}
                    </span>
                  </div>
                  <span className="mt-1 block text-sm text-zinc-700">
                    {TRIGGER_LABEL[s.trigger] ?? s.trigger}
                    {s.triggerProduct ? ` · ${s.triggerProduct.title}` : ""}
                  </span>
                  <span className="mt-1 block text-xs text-muted">
                    {s._count.steps} step{s._count.steps === 1 ? "" : "s"} ·{" "}
                    {s._count.enrollments} enrolled
                  </span>
                </div>
                <div className="shrink-0 text-right text-sm">
                  <div className="flex items-center gap-3">
                    <Link href={`/sequences/${s.id}`} className="text-brand-strong underline">
                      Edit
                    </Link>
                    {s.active ? (
                      <form action={setSequenceActiveAction.bind(null, s.id, false)}>
                        <button className="text-muted underline hover:text-zinc-900">Pause</button>
                      </form>
                    ) : (
                      <form action={setSequenceActiveAction.bind(null, s.id, true)}>
                        <button className="text-muted underline hover:text-zinc-900">
                          Activate
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </GlassCard>
      )}
    </div>
  );
}
