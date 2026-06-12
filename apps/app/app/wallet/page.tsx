import {formatDateTimeIST} from "@invoxai/utils/date";
import { GlassCard, PageHeader } from "@invoxai/ui";
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
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · wallet"
        title="Prepaid wallet"
        description="Your wallet pays InvoxAI’s fees (commission, AI pages, add-ons). It holds only your own funds — buyer payments never touch it."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <GlassCard title="Balance">
          <p className="text-3xl font-bold text-zinc-900">
            {formatRupees(balance)}
          </p>
        </GlassCard>
        <GlassCard title="Add money">
          <WalletTopup />
        </GlassCard>
      </div>

      <h2 className="mt-8 text-lg font-semibold text-zinc-900">Transactions</h2>
      {txns.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No transactions yet.</p>
      ) : (
        <GlassCard className="mt-4 overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-muted">
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
                  <tr key={t.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                    <td className="px-4 py-3 text-muted">
                      {formatDateTime(t.createdAt)}
                    </td>
                    <td className="px-4 py-3">{t.reason}</td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        credit ? "text-green-700" : "text-zinc-900"
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
        </GlassCard>
      )}
    </div>
  );
}
