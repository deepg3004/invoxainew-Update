import {formatDateIST} from "@invoxai/utils/date";
import { GlassCard } from "@invoxai/ui";
import { listActivePlans, getSubscriptionByTenant } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";
import { BillingPlans } from "./BillingPlans";

export const dynamic = "force-dynamic";

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return formatDateIST(d);
}

export default async function BillingPage() {
  const { tenant } = await requireTenant();
  const [plans, subscription] = await Promise.all([
    listActivePlans(),
    getSubscriptionByTenant(tenant.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-muted">
        InvoxAI · billing
      </p>
      <h1 className="mt-1 text-3xl font-bold">Plan & subscription</h1>
      <p className="mt-2 text-muted">
        Subscribe to a plan to unlock higher limits and lower commission. You pay
        InvoxAI securely via Razorpay.
      </p>

      <div className="mt-8">
        <GlassCard title="Current plan">
          {subscription ? (
            <div className="text-sm">
              <p className="text-lg font-semibold text-white">
                {subscription.plan.name}
              </p>
              <p className="mt-1 text-muted">
                Status: <strong>{subscription.status}</strong> ·{" "}
                {subscription.billingCycle.toLowerCase()} · renews{" "}
                {formatDate(subscription.currentPeriodEnd)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted">
              You’re not subscribed to a plan yet. Pick one below.
            </p>
          )}
        </GlassCard>
      </div>

      <h2 className="mt-10 text-xl font-bold">Choose a plan</h2>
      <BillingPlans
        plans={plans.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          priceMonthly: p.priceMonthly,
          priceYearly: p.priceYearly,
          commissionBps: p.commissionBps,
          maxProducts: p.maxProducts,
          maxAiPages: p.maxAiPages,
          monthlyLabel: formatRupees(p.priceMonthly),
          yearlyLabel: formatRupees(p.priceYearly),
        }))}
        currentPlanId={subscription?.planId ?? null}
      />
    </div>
  );
}
