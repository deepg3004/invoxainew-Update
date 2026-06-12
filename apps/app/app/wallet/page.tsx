import {formatDateTimeIST} from "@invoxai/utils/date";
import { GlassCard } from "@invoxai/ui";
import {
  getWalletByTenant,
  listWalletTransactions,
} from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";
import { WalletTopup } from "./WalletTopup";

export const dynamic = "force-dynamic";

function formatDateTime(d: Date): string {
  return formatDateTimeIST(d);
}

export default async function WalletPage() {
  const { tenant } = await requireTenant();
  const [wallet, txns] = await Promise.all([
    getWalletByTenant(tenant.id),
    listWalletTransactions(tenant.id),
  ]);
  const balance = wallet?.balancePaise ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-muted">
        InvoxAI · wallet
      </p>
      <h1 className="mt-1 text-3xl font-bold">Prepaid wallet</h1>
      <p className="mt-2 text-muted">
        Your wallet pays InvoxAI’s fees (commission, AI pages, add-ons). It holds
        only your own funds — buyer payments never touch it.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <GlassCard title="Balance">
          <p className="text-3xl font-bold text-white">
            {formatRupees(balance)}
          </p>
        </GlassCard>
        <GlassCard title="Add money">
          <WalletTopup />
        </GlassCard>
      </div>

      <h2 className="mt-10 text-xl font-bold">Transactions</h2>
      {txns.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No transactions yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {txns.map((t) => {
                const credit = t.direction === "CREDIT";
                return (
                  <tr key={t.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-3 text-muted">
                      {formatDateTime(t.createdAt)}
                    </td>
                    <td className="px-4 py-3">{t.reason}</td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        credit ? "text-green-700" : "text-white"
                      }`}
                    >
                      {credit ? "+" : "−"}
                      {formatRupees(t.amountPaise)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted">
                      {formatRupees(t.balanceAfter)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
