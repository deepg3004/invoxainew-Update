import { formatDateTimeShortIST } from "@invoxai/utils/date";
import Link from "next/link";
import { GlassCard, PageHeader, Pagination, pageSlice } from "@invoxai/ui";
import {
  listFeatureCharges,
  countFeatureCharges,
  sumFeatureChargesPaise,
} from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";

export const dynamic = "force-dynamic";

/** How a charge was paid — currently always wallet (direct-gateway is a later slice). */
function payViaLabel(payVia: string): string {
  if (payVia === "wallet") return "Wallet";
  if (payVia === "direct") return "Direct payment";
  return payVia;
}

export default async function FeaturePaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; size?: string }>;
}) {
  const { tenant } = await requireTenant();
  const { page: rawPage, size: rawSize } = await searchParams;

  const total = await countFeatureCharges(tenant.id);
  const { page, totalPages, skip, take, pageSize } = pageSlice(total, rawPage, rawSize);
  const [charges, lifetimePaise] = await Promise.all([
    listFeatureCharges(tenant.id, { skip, take }),
    sumFeatureChargesPaise(tenant.id),
  ]);
  const firstOnPage = total === 0 ? 0 : skip + 1;
  const lastOnPage = skip + charges.length;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · billing"
        title="Feature charges"
        description={
          <>
            Charges for paid features beyond your plan's free allowance (e.g. AI
            pages). These are billed from your wallet — see the matching debit in{" "}
            <Link href="/wallet" className="text-brand-strong underline">
              Wallet
            </Link>
            .
          </>
        }
      />

      {total > 0 ? (
        <p className="mt-4 text-sm text-muted">
          Lifetime feature spend:{" "}
          <strong className="text-zinc-900">{formatRupees(lifetimePaise)}</strong>
        </p>
      ) : null}

      <GlassCard className="mt-6 overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Feature</th>
              <th className="px-4 py-3 font-medium text-right">Base</th>
              <th className="px-4 py-3 font-medium text-right">GST</th>
              <th className="px-4 py-3 font-medium text-right">Total</th>
              <th className="px-4 py-3 font-medium">Paid via</th>
            </tr>
          </thead>
          <tbody>
            {charges.map((c) => (
              <tr key={c.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                <td className="px-4 py-3 whitespace-nowrap text-muted">
                  {formatDateTimeShortIST(c.createdAt)}
                </td>
                <td className="px-4 py-3 font-medium text-zinc-900">{c.name}</td>
                <td className="px-4 py-3 text-right">{formatRupees(c.basePaise)}</td>
                <td className="px-4 py-3 text-right text-muted">{formatRupees(c.gstPaise)}</td>
                <td className="px-4 py-3 text-right font-medium text-zinc-900">
                  {formatRupees(c.totalPaise)}
                </td>
                <td className="px-4 py-3">{payViaLabel(c.payVia)}</td>
              </tr>
            ))}
            {charges.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  No feature charges yet. You're within your plan's free allowances.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </GlassCard>

      {total > 0 ? (
        <Pagination
          page={page}
          totalPages={totalPages}
          firstOnPage={firstOnPage}
          lastOnPage={lastOnPage}
          total={total}
          pageSize={pageSize}
          label="charges"
        />
      ) : null}
    </div>
  );
}
