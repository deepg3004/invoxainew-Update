import { Card } from "@invoxai/ui";
import {
  getWalletByTenant,
  listWalletTransactions,
} from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";
import { WalletTopup } from "./WalletTopup";

export const dynamic = "force-dynamic";

function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function WalletPage() {
  const { tenant } = await requireTenant();
  const [wallet, txns] = await Promise.all([
    getWalletByTenant(tenant.id),
    listWalletTransactions(tenant.id),
  ]);
  const balance = wallet?.balancePaise ?? 0;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-neutral-400">
        InvoxAI · wallet
      </p>
      <h1 className="mt-1 text-3xl font-bold">Prepaid wallet</h1>
      <p className="mt-2 text-neutral-500">
        Your wallet pays InvoxAI’s fees (commission, AI pages, add-ons). It holds
        only your own funds — buyer payments never touch it.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card title="Balance">
          <p className="text-3xl font-bold text-neutral-900">
            {formatRupees(balance)}
          </p>
        </Card>
        <Card title="Add money">
          <WalletTopup />
        </Card>
      </div>

      <h2 className="mt-10 text-xl font-bold">Transactions</h2>
      {txns.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">No transactions yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-neutral-500">
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
                    <td className="px-4 py-3 text-neutral-500">
                      {formatDateTime(t.createdAt)}
                    </td>
                    <td className="px-4 py-3">{t.reason}</td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        credit ? "text-green-700" : "text-neutral-900"
                      }`}
                    >
                      {credit ? "+" : "−"}
                      {formatRupees(t.amountPaise)}
                    </td>
                    <td className="px-4 py-3 text-right text-neutral-500">
                      {formatRupees(t.balanceAfter)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
