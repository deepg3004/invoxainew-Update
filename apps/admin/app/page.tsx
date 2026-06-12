import Link from "next/link";
import { GlassCard } from "@invoxai/ui";
import { getPlatformOverview, listPlans, listPricingSettings } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireAdmin } from "../lib/auth";
import { AdminShell } from "./components/AdminShell";
import { NotAuthorized } from "./components/NotAuthorized";

// Reads live DB state, so it must be dynamic.
export const dynamic = "force-dynamic";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-surface p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-white">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

export default async function Home() {
  const gate = await requireAdmin();
  if (!gate.ok) return <NotAuthorized email={gate.user.email} />;

  const [ov, plans, settings] = await Promise.all([
    getPlatformOverview(),
    listPlans(),
    listPricingSettings(),
  ]);
  const activePlans = plans.filter((p) => p.isActive).length;

  return (
    <AdminShell email={gate.user.email}>
      <p className="text-sm font-medium uppercase tracking-wide text-muted">
        InvoxAI · admin
      </p>
      <h1 className="mt-1 text-3xl font-bold">Platform overview</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Tenants" value={String(ov.tenants)} hint={`${ov.activeSubscriptions} active subscriptions`} />
        <Stat label="Buyers" value={String(ov.buyerAccounts)} />
        <Stat label="Paid orders" value={String(ov.paidOrders)} />
        <Stat label="GMV (seller-direct)" value={formatRupees(ov.gmvPaise)} hint="Settled to seller gateways" />
        <Stat
          label="InvoxAI commission"
          value={formatRupees(ov.commissionPaidPaise)}
          hint={ov.commissionDuePaise > 0 ? `${formatRupees(ov.commissionDuePaise)} due` : "all collected"}
        />
        <Stat label="Seller wallet balances" value={formatRupees(ov.walletBalancePaise)} hint={`${ov.aiPages} AI pages generated`} />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <GlassCard title="Tenants">
          <p className="text-sm text-muted">Search and inspect every seller.</p>
          <Link href="/tenants" className="mt-3 inline-block text-sm font-medium text-cyan underline">
            View tenants →
          </Link>
        </GlassCard>
        <GlassCard title="Plans">
          <p className="text-sm text-muted">
            {plans.length} plan{plans.length === 1 ? "" : "s"} · {activePlans} active
          </p>
          <Link href="/plans" className="mt-3 inline-block text-sm font-medium text-cyan underline">
            Manage plans →
          </Link>
        </GlassCard>
        <GlassCard title="Pricing settings">
          <p className="text-sm text-muted">
            {settings.length} setting{settings.length === 1 ? "" : "s"}
          </p>
          <Link href="/pricing" className="mt-3 inline-block text-sm font-medium text-cyan underline">
            Manage pricing →
          </Link>
        </GlassCard>
      </div>
    </AdminShell>
  );
}
