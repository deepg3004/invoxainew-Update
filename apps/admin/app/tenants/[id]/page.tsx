import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@invoxai/ui";
import { getTenantAdminDetail, getTenantSalesSummary } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { maskKeyId } from "@invoxai/utils/crypto";
import { requireAdmin } from "../../../lib/auth";
import { AdminShell } from "../../components/AdminShell";
import { NotAuthorized } from "../../components/NotAuthorized";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export default async function TenantDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const gate = await requireAdmin();
  if (!gate.ok) return <NotAuthorized email={gate.user.email} />;

  const { id } = await params;
  const t = await getTenantAdminDetail(id);
  if (!t) notFound();
  const summary = await getTenantSalesSummary(t.id);

  return (
    <AdminShell email={gate.user.email}>
      <Link href="/tenants" className="text-sm text-blue-600 underline">
        ← Tenants
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{t.name ?? t.username}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {t.username}.invoxai.io · owner {t.owner.email ?? "—"} · joined{" "}
        {fmtDate(t.createdAt)}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card title="Subscription">
          {t.subscription ? (
            <p className="text-sm">
              <strong>{t.subscription.plan.name}</strong> · {t.subscription.status}
              <br />
              <span className="text-neutral-500">
                {t.subscription.billingCycle.toLowerCase()} · renews{" "}
                {fmtDate(t.subscription.currentPeriodEnd)}
              </span>
            </p>
          ) : (
            <p className="text-sm text-neutral-400">No subscription</p>
          )}
        </Card>
        <Card title="Wallet">
          <p className="text-2xl font-bold">
            {formatRupees(t.wallet?.balancePaise ?? 0)}
          </p>
        </Card>
        <Card title="Gateway">
          {t.gateway ? (
            <p className="text-sm">
              {t.gateway.provider} · {maskKeyId(t.gateway.keyId)}
              <br />
              <span className={t.gateway.mode === "LIVE" ? "text-green-700" : "text-amber-600"}>
                {t.gateway.mode}
              </span>{" "}
              · {t.gateway.status}
            </p>
          ) : (
            <p className="text-sm text-neutral-400">Not connected</p>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Card title="Orders">
          <p className="text-xl font-bold">{summary.orderCount}</p>
        </Card>
        <Card title="GMV">
          <p className="text-xl font-bold">{formatRupees(summary.grossPaise)}</p>
        </Card>
        <Card title="Commission">
          <p className="text-xl font-bold">{formatRupees(summary.commissionPaidPaise)}</p>
          {summary.commissionDuePaise > 0 ? (
            <p className="text-xs text-amber-600">{formatRupees(summary.commissionDuePaise)} due</p>
          ) : null}
        </Card>
      </div>

      {/* Recent wallet ledger */}
      <h2 className="mt-8 text-lg font-bold">Wallet ledger (recent)</h2>
      {t.wallet && t.wallet.transactions.length > 0 ? (
        <div className="mt-2 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <tbody>
              {t.wallet.transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2 text-neutral-500">{fmtDate(tx.createdAt)}</td>
                  <td className="px-4 py-2">{tx.reason}</td>
                  <td
                    className={`px-4 py-2 text-right font-medium ${
                      tx.direction === "CREDIT" ? "text-green-700" : "text-neutral-900"
                    }`}
                  >
                    {tx.direction === "CREDIT" ? "+" : "−"}
                    {formatRupees(tx.amountPaise)}
                  </td>
                  <td className="px-4 py-2 text-right text-neutral-400">
                    {formatRupees(tx.balanceAfter)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-2 text-sm text-neutral-400">No wallet activity.</p>
      )}

      {/* Recent orders */}
      <h2 className="mt-8 text-lg font-bold">Recent orders</h2>
      {t.buyerPayments.length > 0 ? (
        <div className="mt-2 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <tbody>
              {t.buyerPayments.map((o) => (
                <tr key={o.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2 font-medium text-neutral-900">{o.paymentPage.title}</td>
                  <td className="px-4 py-2 text-neutral-500">{o.buyerEmail ?? "—"}</td>
                  <td className="px-4 py-2 text-neutral-500">{o.fulfillmentStatus}</td>
                  <td className="px-4 py-2 text-right">{formatRupees(o.amountPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-2 text-sm text-neutral-400">No orders.</p>
      )}

      {/* Pages */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card title={`Payment pages (${t.paymentPages.length})`}>
          {t.paymentPages.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {t.paymentPages.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span>
                    /pay/{p.slug}
                    {p.isActive ? "" : " (off)"}
                  </span>
                  <span className="text-neutral-500">{formatRupees(p.amountPaise)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-400">None</p>
          )}
        </Card>
        <Card title={`AI pages (${t.aiPages.length})`}>
          {t.aiPages.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {t.aiPages.map((p) => (
                <li key={p.id}>/{p.slug} — {p.title}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-400">None</p>
          )}
        </Card>
      </div>
    </AdminShell>
  );
}
