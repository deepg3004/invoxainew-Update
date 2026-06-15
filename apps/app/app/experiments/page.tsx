import { Button, GlassCard, PageHeader } from "@invoxai/ui";
import { listExperiments } from "@invoxai/db";
import { summarizeExperiment } from "@invoxai/utils/experiment";
import { requireTenant } from "../../lib/tenant";
import { stopExperimentAction, deleteExperimentAction } from "./actions";

export const dynamic = "force-dynamic";

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export default async function ExperimentsPage() {
  const { tenant } = await requireTenant();
  const experiments = await listExperiments(tenant.id);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · growth"
        title="A/B tests"
        description="Test two headlines on a payment page. Visitors are split 50/50; we track which converts better."
        actions={
          <Button href="/experiments/new" size="sm">
            New A/B test
          </Button>
        }
      />

      {experiments.length === 0 ? (
        <GlassCard>
          <p className="text-muted">
            No A/B tests yet. Start one on a payment page to compare two headlines.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {experiments.map((e) => {
            const s = summarizeExperiment(e);
            const running = e.status === "RUNNING";
            return (
              <GlassCard key={e.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-zinc-900">
                        {e.paymentPage?.title ?? "Payment page"}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          running ? "bg-green-50 text-green-700" : "bg-zinc-100 text-muted"
                        }`}
                      >
                        {running ? "Running" : "Stopped"}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-sm">
                    {running ? (
                      <form action={stopExperimentAction.bind(null, e.id)}>
                        <button className="text-muted underline hover:text-zinc-900">Stop</button>
                      </form>
                    ) : null}
                    <form action={deleteExperimentAction.bind(null, e.id)}>
                      <button className="text-muted underline hover:text-red-700">Delete</button>
                    </form>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <VariantCard
                    label="A · original"
                    views={e.aViews}
                    conversions={e.aConversions}
                    rate={s.aRate}
                    winner={s.leader === "A"}
                  />
                  <VariantCard
                    label="B · variant"
                    sub={e.variantBTitle}
                    views={e.bViews}
                    conversions={e.bConversions}
                    rate={s.bRate}
                    winner={s.leader === "B"}
                  />
                </div>

                <p className="mt-3 text-xs text-muted">
                  {s.leader === "none"
                    ? "Collecting data — both variants need at least one view."
                    : s.leader === "tie"
                      ? "Variants are converting equally so far."
                      : `Variant ${s.leader} is ahead by ${s.liftPct.toFixed(0)}% on conversion rate${
                          running ? "" : " (final)"
                        }.`}
                </p>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );

  function VariantCard({
    label,
    sub,
    views,
    conversions,
    rate,
    winner,
  }: {
    label: string;
    sub?: string;
    views: number;
    conversions: number;
    rate: number;
    winner: boolean;
  }) {
    return (
      <div
        className={`rounded-xl border p-4 ${winner ? "border-brand bg-brand/5" : "border-zinc-200"}`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
          {winner ? (
            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand-strong">
              Leading
            </span>
          ) : null}
        </div>
        {sub ? <div className="mt-1 truncate text-sm text-zinc-700">{sub}</div> : null}
        <div className="mt-2 text-2xl font-bold text-zinc-900">{pct(rate)}</div>
        <div className="text-xs text-muted">
          {conversions} of {views} view{views === 1 ? "" : "s"}
        </div>
      </div>
    );
  }
}
