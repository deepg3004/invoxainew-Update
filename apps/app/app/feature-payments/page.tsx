import { formatDateTimeShortIST } from "@invoxai/utils/date";
import Link from "next/link";
import { GlassCard, PageHeader, Pagination, pageSlice } from "@invoxai/ui";
import {
  listFeatureCharges,
  countFeatureCharges,
  sumFeatureChargesPaise,
  availableFeatureCreditsByKey,
  listFeatureRules,
} from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";
import { BuyFeatureCredit } from "./BuyFeatureCredit";

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
  const [charges, lifetimePaise, rules, creditsByKey] = await Promise.all([
    listFeatureCharges(tenant.id, { skip, take }),
    sumFeatureChargesPaise(tenant.id),
    listFeatureRules(),
    availableFeatureCreditsByKey(tenant.id),
  ]);
  // Features payable directly via the platform gateway (pay-per-use credits).
  const directRules = rules.filter((r) => r.active && r.directEnabled);
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

      {directRules.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-zinc-900">Pay-per-use credits</h2>
          <p className="mt-1 text-sm text-muted">
            Prefer not to keep wallet balance? Buy a credit and it's used automatically
            the next time you use the feature.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {directRules.map((r) => {
              const gstPaise = Math.round((r.basePaise * r.gstRateBps) / 10000);
              const pricePaise = r.basePaise + gstPaise;
              const available = creditsByKey[r.featureKey] ?? 0;
              return (
                <GlassCard key={r.featureKey} className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium text-zinc-900">{r.name}</div>
                    <div className="text-sm text-muted">
                      {available > 0
                        ? `${available} credit${available === 1 ? "" : "s"} available`
                        : "No credits — buy one to use this feature"}
                    </div>
                  </div>
                  <BuyFeatureCredit
                    featureKey={r.featureKey}
                    featureName={r.name}
                    pricePaise={pricePaise}
                  />
                </GlassCard>
              );
            })}
          </div>
        </section>
      ) : null}

      <h2 className="mt-8 text-lg font-semibold text-zinc-900">Charge history</h2>
      <GlassCard className="mt-3 overflow-hidden p-0">
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
