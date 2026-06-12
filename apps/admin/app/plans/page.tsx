import Link from "next/link";
import { Button, GlassCard, PageHeader } from "@invoxai/ui";
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
      <PageHeader
        eyebrow="InvoxAI · admin"
        title="Plans"
        actions={
          <Button href="/plans/new" size="sm">
            New plan
          </Button>
        }
      />

      {plans.length === 0 ? (
        <GlassCard>
          <p className="text-sm text-muted">No plans yet. Create the first one.</p>
        </GlassCard>
      ) : (
        <GlassCard className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-muted">
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
                <tr key={p.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-900">{p.name}</div>
                    <div className="text-xs text-muted">{p.key}</div>
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
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-muted">
                        Retired
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/plans/${p.id}`}
                        className="text-brand-strong underline"
                      >
                        Edit
                      </Link>
                      <form action={setPlanActiveAction.bind(null, p.id, !p.isActive)}>
                        <button className="text-muted underline hover:text-zinc-900">
                          {p.isActive ? "Retire" : "Restore"}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      )}
    </AdminShell>
  );
}
