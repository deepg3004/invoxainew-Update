import Link from "next/link";
import { searchBuyerPayments } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireAdmin } from "../../lib/auth";
import { AdminShell } from "../components/AdminShell";
import { NotAuthorized } from "../components/NotAuthorized";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export default async function BuyersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const gate = await requireAdmin();
  if (!gate.ok) return <NotAuthorized email={gate.user.email} />;

  const { q } = await searchParams;
  const results = q ? await searchBuyerPayments(q) : [];

  return (
    <AdminShell email={gate.user.email}>
      <h1 className="text-2xl font-bold">Buyer lookup</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Find a buyer’s payments across all sellers by email or phone (support).
      </p>

      <form method="get" className="mt-4 flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="buyer email or phone"
          className="w-full max-w-md rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
        />
        <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
          Search
        </button>
      </form>

      {!q ? (
        <p className="mt-6 text-sm text-neutral-400">Enter an email or phone to search.</p>
      ) : results.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">No payments found for “{q}”.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Buyer</th>
                <th className="px-4 py-3 font-medium">Seller</th>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3 text-neutral-500">{fmtDate(r.paidAt ?? r.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div>{r.buyerEmail ?? "—"}</div>
                    {r.buyerContact ? <div className="text-xs text-neutral-400">{r.buyerContact}</div> : null}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/tenants/${r.tenant.id}`} className="text-blue-600 underline">
                      {r.tenant.username}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{r.paymentPage.title}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-neutral-500">{r.status}</span>
                    {r.status === "PAID" ? (
                      <span className="ml-1 text-xs text-neutral-400">· {r.fulfillmentStatus}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right">{formatRupees(r.amountPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
