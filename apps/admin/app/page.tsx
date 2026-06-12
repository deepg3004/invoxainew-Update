import Link from "next/link";
import { GlassCard, PageHeader, StatCard } from "@invoxai/ui";
import { getPlatformOverview, listPlans, listPricingSettings } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireAdmin } from "../lib/auth";
import { AdminShell } from "./components/AdminShell";
import { NotAuthorized } from "./components/NotAuthorized";

// Reads live DB state, so it must be dynamic.
export const dynamic = "force-dynamic";

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
      <PageHeader eyebrow="InvoxAI · admin" title="Platform overview" />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Tenants" value={String(ov.tenants)} hint={`${ov.activeSubscriptions} active subscriptions`} />
        <StatCard label="Buyers" value={String(ov.buyerAccounts)} />
        <StatCard label="Paid orders" value={String(ov.paidOrders)} />
        <StatCard label="GMV (seller-direct)" value={formatRupees(ov.gmvPaise)} hint="Settled to seller gateways" />
        <StatCard
          label="InvoxAI commission"
          value={formatRupees(ov.commissionPaidPaise)}
          accent={ov.commissionDuePaise > 0 ? "warning" : "success"}
          hint={ov.commissionDuePaise > 0 ? `${formatRupees(ov.commissionDuePaise)} due` : "all collected"}
        />
        <StatCard label="Seller wallet balances" value={formatRupees(ov.walletBalancePaise)} hint={`${ov.aiPages} AI pages generated`} />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <GlassCard title="Tenants">
          <p className="text-sm text-muted">Search and inspect every seller.</p>
          <Link href="/tenants" className="mt-3 inline-block text-sm font-medium text-brand-strong underline">
            View tenants →
          </Link>
        </GlassCard>
        <GlassCard title="Plans">
          <p className="text-sm text-muted">
            {plans.length} plan{plans.length === 1 ? "" : "s"} · {activePlans} active
          </p>
          <Link href="/plans" className="mt-3 inline-block text-sm font-medium text-brand-strong underline">
            Manage plans →
          </Link>
        </GlassCard>
        <GlassCard title="Pricing settings">
          <p className="text-sm text-muted">
            {settings.length} setting{settings.length === 1 ? "" : "s"}
          </p>
          <Link href="/pricing" className="mt-3 inline-block text-sm font-medium text-brand-strong underline">
            Manage pricing →
          </Link>
        </GlassCard>
      </div>
    </AdminShell>
  );
}
