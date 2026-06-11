import Link from "next/link";
import { listPlans } from "@invoxai/db";
import { formatRupees, bpsToPercentString } from "@invoxai/utils/money";
import { requireAdmin } from "../../lib/auth";
import { AdminShell } from "../components/AdminShell";
import { NotAuthorized } from "../components/NotAuthorized";
import { setPlanActiveAction } from "./actions";

export const dynamic = "force-dynamic";

function limit(n: number | null): string {
  return n === null ? "∞" : String(n);
}

export default async function PlansPage() {
  const gate = await requireAdmin();
  if (!gate.ok) return <NotAuthorized email={gate.user.email} />;

  const plans = await listPlans();

  return (
    <AdminShell email={gate.user.email}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Plans</h1>
        <Link
          href="/plans/new"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          New plan
        </Link>
      </div>

      {plans.length === 0 ? (
        <p className="mt-8 text-neutral-500">
          No plans yet. Create the first one.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Monthly</th>
                <th className="px-4 py-3 font-medium">Yearly</th>
                <th className="px-4 py-3 font-medium">Commission</th>
                <th className="px-4 py-3 font-medium">Products</th>
                <th className="px-4 py-3 font-medium">AI pages</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-900">{p.name}</div>
                    <div className="text-xs text-neutral-400">{p.key}</div>
                  </td>
                  <td className="px-4 py-3">{formatRupees(p.priceMonthly)}</td>
                  <td className="px-4 py-3">{formatRupees(p.priceYearly)}</td>
                  <td className="px-4 py-3">{bpsToPercentString(p.commissionBps)}%</td>
                  <td className="px-4 py-3">{limit(p.maxProducts)}</td>
                  <td className="px-4 py-3">{limit(p.maxAiPages)}</td>
                  <td className="px-4 py-3">
                    {p.isActive ? (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
                        Retired
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/plans/${p.id}`}
                        className="text-blue-600 underline"
                      >
                        Edit
                      </Link>
                      <form action={setPlanActiveAction.bind(null, p.id, !p.isActive)}>
                        <button className="text-neutral-500 underline hover:text-neutral-900">
                          {p.isActive ? "Retire" : "Restore"}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
