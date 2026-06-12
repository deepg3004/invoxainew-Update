import {formatDateIST} from "@invoxai/utils/date";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GlassCard, PageHeader, StatCard } from "@invoxai/ui";
import {
  getTenantAdminDetail,
  getTenantSalesSummary,
  listAdminAuditLog,
} from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { maskKeyId } from "@invoxai/utils/crypto";
import { requireAdmin } from "../../../lib/auth";
import { AdminShell } from "../../components/AdminShell";
import { NotAuthorized } from "../../components/NotAuthorized";
import { toggleSuspendAction, markChargebackAction } from "./actions";
import { WalletAdjustForm } from "./WalletAdjustForm";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return formatDateIST(d);
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
  const [summary, audit] = await Promise.all([
    getTenantSalesSummary(t.id),
    listAdminAuditLog(t.id),
  ]);
  const suspended = Boolean(t.suspendedAt);

  return (
    <AdminShell email={gate.user.email}>
      <Link href="/tenants" className="text-sm text-brand-strong underline">
        ← Tenants
      </Link>
      <PageHeader
        eyebrow="InvoxAI · admin"
        title={t.name ?? t.username}
        description={
          <>
            {t.username}.invoxai.io · owner {t.owner.email ?? "—"} · joined{" "}
            {fmtDate(t.createdAt)}
          </>
        }
        actions={
          suspended ? (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
              SUSPENDED
            </span>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <GlassCard title="Subscription">
          {t.subscription ? (
            <p className="text-sm">
              <strong>{t.subscription.plan.name}</strong> · {t.subscription.status}
              <br />
              <span className="text-muted">
                {t.subscription.billingCycle.toLowerCase()} · renews{" "}
                {fmtDate(t.subscription.currentPeriodEnd)}
              </span>
            </p>
          ) : (
            <p className="text-sm text-muted">No subscription</p>
          )}
        </GlassCard>
        <StatCard label="Wallet" value={formatRupees(t.wallet?.balancePaise ?? 0)} />
        <GlassCard title="Gateway">
          {t.gateway ? (
            <p className="text-sm">
              {t.gateway.provider} · {maskKeyId(t.gateway.keyId)}
              <br />
              <span className={t.gateway.mode === "LIVE" ? "text-green-700" : "text-warning"}>
                {t.gateway.mode}
              </span>{" "}
              · {t.gateway.status}
            </p>
          ) : (
            <p className="text-sm text-muted">Not connected</p>
          )}
        </GlassCard>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Orders" value={summary.orderCount} />
        <StatCard label="GMV" value={formatRupees(summary.grossPaise)} />
        <StatCard
          label="Commission"
          value={formatRupees(summary.commissionPaidPaise)}
          hint={
            summary.commissionDuePaise > 0
              ? `${formatRupees(summary.commissionDuePaise)} due`
              : undefined
          }
          accent={summary.commissionDuePaise > 0 ? "warning" : undefined}
        />
      </div>

      {/* Admin actions */}
      <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/40 p-5 shadow-card">
        <h2 className="text-lg font-semibold text-zinc-900">Admin actions</h2>

        <div className="mt-4">
          <p className="text-sm font-medium text-muted">
            {suspended ? "This store is suspended." : "Store is active."}
          </p>
          <form
            action={toggleSuspendAction.bind(null, t.id, !suspended)}
            className="mt-2 flex flex-wrap items-center gap-2"
          >
            {!suspended ? (
              <input
                name="reason"
                placeholder="Reason for suspension (logged)"
                className="min-w-64 flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand"
              />
            ) : null}
            <button
              className={`rounded-lg px-3 py-1.5 text-sm font-medium text-white ${
                suspended ? "bg-green-700" : "bg-red-700"
              }`}
            >
              {suspended ? "Un-suspend store" : "Suspend store"}
            </button>
          </form>
        </div>

        <div className="mt-5 border-t border-amber-200 pt-4">
          <p className="text-sm font-medium text-muted">Manual wallet adjustment</p>
          <p className="mb-2 text-xs text-muted">
            Moves the seller’s own wallet money only (refunds, corrections). Never
            buyer money. Every change is logged below.
          </p>
          <WalletAdjustForm tenantId={t.id} />
        </div>
      </div>

      {/* Audit log */}
      {audit.length > 0 ? (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-zinc-900">Admin audit log</h2>
          <GlassCard className="mt-2 overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id} className="border-t border-zinc-100 first:border-0 hover:bg-zinc-50">
                    <td className="px-4 py-3 text-muted">{fmtDate(a.createdAt)}</td>
                    <td className="px-4 py-3 font-medium">{a.action}</td>
                    <td className="px-4 py-3 text-muted">
                      {a.amountPaise != null ? formatRupees(a.amountPaise) + " · " : ""}
                      {a.detail ?? ""}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted">
                      {a.adminEmail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassCard>
        </div>
      ) : null}

      {/* Recent wallet ledger */}
      <h2 className="mt-8 text-lg font-semibold text-zinc-900">Wallet ledger (recent)</h2>
      {t.wallet && t.wallet.transactions.length > 0 ? (
        <GlassCard className="mt-2 overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <tbody>
              {t.wallet.transactions.map((tx) => (
                <tr key={tx.id} className="border-t border-zinc-100 first:border-0 hover:bg-zinc-50">
                  <td className="px-4 py-3 text-muted">{fmtDate(tx.createdAt)}</td>
                  <td className="px-4 py-3">{tx.reason}</td>
                  <td
                    className={`px-4 py-3 text-right font-medium ${
                      tx.direction === "CREDIT" ? "text-green-700" : "text-zinc-900"
                    }`}
                  >
                    {tx.direction === "CREDIT" ? "+" : "−"}
                    {formatRupees(tx.amountPaise)}
                  </td>
                  <td className="px-4 py-3 text-right text-muted">
                    {formatRupees(tx.balanceAfter)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      ) : (
        <p className="mt-2 text-sm text-muted">No wallet activity.</p>
      )}

      {/* Recent orders */}
      <h2 className="mt-8 text-lg font-semibold text-zinc-900">Recent orders</h2>
      {t.buyerPayments.length > 0 ? (
        <GlassCard className="mt-2 overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <tbody>
              {t.buyerPayments.map((o) => (
                <tr key={o.id} className="border-t border-zinc-100 first:border-0 hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    {o.itemTitle ?? o.paymentPage?.title ?? "—"}
                    {o.refundedPaise > 0 && !o.chargebackAt ? (
                      <span className="ml-2 text-xs text-warning">
                        refunded {formatRupees(o.refundedPaise)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted">{o.buyerEmail ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{o.fulfillmentStatus}</td>
                  <td className="px-4 py-3 text-right">{formatRupees(o.amountPaise)}</td>
                  <td className="px-4 py-3 text-right">
                    {o.chargebackAt ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                        CHARGEBACK
                      </span>
                    ) : (
                      <form action={markChargebackAction.bind(null, t.id, o.id)}>
                        <button className="text-xs text-red-700 underline hover:text-red-900">
                          Mark chargeback
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      ) : (
        <p className="mt-2 text-sm text-muted">No orders.</p>
      )}

      {/* Pages */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <GlassCard title={`Payment pages (${t.paymentPages.length})`}>
          {t.paymentPages.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {t.paymentPages.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span>
                    /pay/{p.slug}
                    {p.isActive ? "" : " (off)"}
                  </span>
                  <span className="text-muted">{formatRupees(p.amountPaise)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">None</p>
          )}
        </GlassCard>
        <GlassCard title={`AI pages (${t.aiPages.length})`}>
          {t.aiPages.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {t.aiPages.map((p) => (
                <li key={p.id}>/{p.slug} — {p.title}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">None</p>
          )}
        </GlassCard>
      </div>
    </AdminShell>
  );
}
