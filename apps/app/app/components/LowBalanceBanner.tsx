import Link from "next/link";
import { formatRupees } from "@invoxai/utils/money";

/**
 * In-app low-balance / arrears warning (Phase 1.5). Shown when the seller's
 * wallet is low or they have outstanding (DUE) commission — so they top up
 * before commission keeps piling up or AI pages get blocked. No email needed.
 */
export function LowBalanceBanner({
  balancePaise,
  dueCommissionPaise,
  thresholdPaise = 5000,
}: {
  balancePaise: number;
  dueCommissionPaise: number;
  thresholdPaise?: number;
}) {
  const low = balancePaise < thresholdPaise;
  const owes = dueCommissionPaise > 0;
  if (!low && !owes) return null;

  return (
    <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      {owes ? (
        <>
          You have <strong>{formatRupees(dueCommissionPaise)}</strong> in unpaid
          commission.{" "}
        </>
      ) : null}
      {low ? (
        <>
          Your wallet balance is low (<strong>{formatRupees(balancePaise)}</strong>
          ).{" "}
        </>
      ) : null}
      Top up so commission keeps settling and AI pages stay available.{" "}
      <Link href="/wallet" className="font-medium underline">
        Top up →
      </Link>
    </div>
  );
}
