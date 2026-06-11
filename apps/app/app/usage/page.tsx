import Link from "next/link";
import { getTenantFeatureUsageSummary } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";

export const dynamic = "force-dynamic";

const thisMonth = new Intl.DateTimeFormat("en-IN", {
  month: "long",
  year: "numeric",
}).format(new Date());

export default async function UsagePage() {
  const { tenant } = await requireTenant();
  const summary = await getTenantFeatureUsageSummary(tenant.id);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-neutral-400">
        InvoxAI · usage
      </p>
      <h1 className="mt-1 text-3xl font-bold">Usage & limits</h1>
      <p className="mt-2 text-neutral-500">
        Your plan{summary.planName ? <> (<strong>{summary.planName}</strong>)</> : null}{" "}
        free allowances for {thisMonth}. Beyond the free amount, features are
        charged from your wallet.
      </p>

      <div className="mt-6 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 text-neutral-500">
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
                <tr key={f.featureKey} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-neutral-900">{f.name}</td>
                  <td className="px-4 py-3">{f.used}</td>
                  <td className="px-4 py-3">
                    {unlimited ? (
                      <span className="text-green-700">Unlimited</span>
                    ) : f.freeLimit === 0 ? (
                      <span className="text-neutral-400">None free</span>
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
                <td colSpan={4} className="px-4 py-6 text-center text-neutral-400">
                  No metered features.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-sm text-neutral-500">
        Need a higher allowance?{" "}
        <Link href="/billing" className="text-blue-600 underline">
          Upgrade your plan
        </Link>{" "}
        or{" "}
        <Link href="/wallet" className="text-blue-600 underline">
          top up your wallet
        </Link>
        .
      </p>
    </main>
  );
}
