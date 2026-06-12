import Link from "next/link";
import { listTenantsAdmin } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireAdmin } from "../../lib/auth";
import { AdminShell } from "../components/AdminShell";
import { NotAuthorized } from "../components/NotAuthorized";

export const dynamic = "force-dynamic";

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const gate = await requireAdmin();
  if (!gate.ok) return <NotAuthorized email={gate.user.email} />;

  const { q } = await searchParams;
  const tenants = await listTenantsAdmin(q);

  return (
    <AdminShell email={gate.user.email}>
      <h1 className="text-2xl font-bold">Tenants</h1>

      <form method="get" className="mt-4 flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by username, name, or owner email"
          className="w-full max-w-md rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand"
        />
        <button className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">
          Search
        </button>
        {q ? (
          <Link href="/tenants" className="px-3 py-2 text-sm text-muted underline">
            Clear
          </Link>
        ) : null}
      </form>

      <p className="mt-4 text-sm text-muted">
        {tenants.length} tenant{tenants.length === 1 ? "" : "s"}
        {q ? ` matching "${q}"` : ""} (max 100)
      </p>

      <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Tenant</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Gateway</th>
              <th className="px-4 py-3 font-medium text-right">Wallet</th>
              <th className="px-4 py-3 font-medium text-right">Orders</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id} className="border-b border-zinc-200 last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/tenants/${t.id}`} className="font-medium text-cyan underline">
                    {t.username}
                  </Link>
                  {t.suspendedAt ? (
                    <span className="ml-2 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                      SUSPENDED
                    </span>
                  ) : null}
                  {t.name ? <div className="text-xs text-muted">{t.name}</div> : null}
                </td>
                <td className="px-4 py-3 text-muted">{t.owner.email ?? "—"}</td>
                <td className="px-4 py-3">
                  {t.subscription ? (
                    <span>
                      {t.subscription.plan.name}
                      <span className="ml-1 text-xs text-muted">
                        {t.subscription.status}
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted">none</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {t.gateway ? (
                    <span className={t.gateway.mode === "LIVE" ? "text-green-700" : "text-warning"}>
                      {t.gateway.mode}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatRupees(t.wallet?.balancePaise ?? 0)}
                </td>
                <td className="px-4 py-3 text-right">{t._count.buyerPayments}</td>
              </tr>
            ))}
            {tenants.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  No tenants found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
