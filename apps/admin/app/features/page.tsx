import { listPlans, listFeatureRules, listPlanFeatureLimits } from "@invoxai/db";
import { paiseToRupeeString, bpsToPercentString } from "@invoxai/utils/money";
import { requireAdmin } from "../../lib/auth";
import { AdminShell } from "../components/AdminShell";
import { NotAuthorized } from "../components/NotAuthorized";
import { saveFeatureRuleAction, setFeatureLimitsAction } from "./actions";

export const dynamic = "force-dynamic";

const input = "rounded-lg border border-white/10 px-2 py-1 text-sm";

export default async function FeaturesPage() {
  const gate = await requireAdmin();
  if (!gate.ok) return <NotAuthorized email={gate.user.email} />;

  const [plans, rules, limits] = await Promise.all([
    listPlans(),
    listFeatureRules(),
    listPlanFeatureLimits(),
  ]);
  const limitOf = (planId: string, featureKey: string) =>
    limits.find((l) => l.planId === planId && l.featureKey === featureKey)?.freeLimit ?? 0;

  return (
    <AdminShell email={gate.user.email}>
      <h1 className="text-2xl font-bold">Feature billing</h1>
      <p className="mt-2 text-muted">
        Admin-priced features. Each plan grants a free monthly allowance
        (−1 = unlimited); beyond it the fee is charged from the seller’s wallet.
      </p>

      {/* Rules */}
      <h2 className="mt-8 text-lg font-bold">Pricing rules</h2>
      <div className="mt-3 space-y-3">
        {rules.map((r) => (
          <form
            key={r.featureKey}
            action={saveFeatureRuleAction}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-surface p-3 text-sm"
          >
            <input type="hidden" name="featureKey" value={r.featureKey} />
            <span className="font-mono text-xs text-muted">{r.featureKey}</span>
            <input name="name" defaultValue={r.name} className={`${input} w-40`} />
            <label className="flex items-center gap-1">₹<input name="base" defaultValue={paiseToRupeeString(r.basePaise)} className={`${input} w-20`} /></label>
            <label className="flex items-center gap-1">GST%<input name="gst" defaultValue={bpsToPercentString(r.gstRateBps)} className={`${input} w-14`} /></label>
            <label className="flex items-center gap-1"><input type="checkbox" name="wallet" defaultChecked={r.walletEnabled} /> wallet</label>
            <label className="flex items-center gap-1"><input type="checkbox" name="direct" defaultChecked={r.directEnabled} /> direct</label>
            <label className="flex items-center gap-1"><input type="checkbox" name="active" defaultChecked={r.active} /> active</label>
            <button className="rounded-lg bg-brand px-3 py-1 font-medium text-white">Save</button>
          </form>
        ))}

        {/* New rule */}
        <form action={saveFeatureRuleAction} className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-white/10 p-3 text-sm">
          <input name="featureKey" placeholder="feature_key" className={`${input} w-32 font-mono`} />
          <input name="name" placeholder="Name" className={`${input} w-40`} />
          <label className="flex items-center gap-1">₹<input name="base" placeholder="0" className={`${input} w-20`} /></label>
          <label className="flex items-center gap-1">GST%<input name="gst" defaultValue="18" className={`${input} w-14`} /></label>
          <label className="flex items-center gap-1"><input type="checkbox" name="wallet" defaultChecked /> wallet</label>
          <label className="flex items-center gap-1"><input type="checkbox" name="direct" /> direct</label>
          <label className="flex items-center gap-1"><input type="checkbox" name="active" defaultChecked /> active</label>
          <button className="rounded-lg border border-white/10 px-3 py-1 font-medium hover:bg-white/5">Add</button>
        </form>
      </div>

      {/* Free limits per plan */}
      <h2 className="mt-10 text-lg font-bold">Free monthly allowance (per plan)</h2>
      <div className="mt-3 space-y-3">
        {rules.map((r) => (
          <form
            key={r.featureKey}
            action={setFeatureLimitsAction.bind(null, r.featureKey)}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-surface p-3 text-sm"
          >
            <span className="w-36 font-medium">{r.name}</span>
            {plans.map((p) => (
              <label key={p.id} className="flex items-center gap-1">
                <span className="text-muted">{p.name}</span>
                <input
                  name={`limit_${p.id}`}
                  defaultValue={limitOf(p.id, r.featureKey)}
                  className={`${input} w-16`}
                />
              </label>
            ))}
            <button className="rounded-lg bg-brand px-3 py-1 font-medium text-white">Save</button>
          </form>
        ))}
      </div>
    </AdminShell>
  );
}
