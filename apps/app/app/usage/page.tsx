import {formatMonthIST} from "@invoxai/utils/date";
import Link from "next/link";
import { GlassCard, PageHeader } from "@invoxai/ui";
import { getTenantFeatureUsageSummary } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";

export const dynamic = "force-dynamic";

const thisMonth = formatMonthIST(new Date());

export default async function UsagePage() {
  const { tenant } = await requireTenant();
  const summary = await getTenantFeatureUsageSummary(tenant.id);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · usage"
        title="Usage & limits"
        description={
          <>
            Your plan{summary.planName ? <> (<strong>{summary.planName}</strong>)</> : null}{" "}
            free allowances for {thisMonth}. Beyond the free amount, features are
            charged from your wallet.
          </>
        }
      />

      <GlassCard className="mt-6 overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Feature</th>
              <th className="px-4 py-3 font-medium">Used this month</th>
              <th className="px-4 py-3 font-medium">Free allowance</th>
              <th className="px-4 py-3 font-medium text-right">Overage price</th>
            </tr>
          </thead>
          <tbody>
            {summary.features.map((f) => {
              const unlimited = f.freeLimit === -1;
              return (
                <tr key={f.featureKey} className="border-t border-zinc-100 hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium text-zinc-900">{f.name}</td>
                  <td className="px-4 py-3">{f.used}</td>
                  <td className="px-4 py-3">
                    {unlimited ? (
                      <span className="text-green-700">Unlimited</span>
                    ) : f.freeLimit === 0 ? (
                      <span className="text-muted">None free</span>
                    ) : (
                      <span>
                        {f.remaining} of {f.freeLimit} left
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {unlimited ? "—" : `${formatRupees(f.totalPaise)} (incl. GST)`}
                  </td>
                </tr>
              );
            })}
            {summary.features.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted">
                  No metered features.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </GlassCard>

      <p className="mt-6 text-sm text-muted">
        Need a higher allowance?{" "}
        <Link href="/billing" className="text-brand-strong underline">
          Upgrade your plan
        </Link>{" "}
        or{" "}
        <Link href="/wallet" className="text-brand-strong underline">
          top up your wallet
        </Link>
        .
      </p>
    </div>
  );
}
