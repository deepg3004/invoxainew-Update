import Link from "next/link";
import { formatRupees } from "@invoxai/utils/money";

/**
 * In-app low-balance / arrears warning (Phase 1.5). Shown when the seller's
 * wallet is low or they have outstanding (DUE) commission — so they top up
 * before commission keeps piling up or AI pages get blocked. No email needed.
 *
 * UPI dues-block (auto-confirm gateway): when the seller offers manual UPI AND
 * their unpaid commission is over the platform ceiling, instant UPI auto-confirm
 * is paused (orders fall to the manual queue) until they top up — surfaced as a
 * stronger message here. Re-enabling is automatic once a top-up settles the dues.
 */
export function LowBalanceBanner({
  balancePaise,
  dueCommissionPaise,
  thresholdPaise = 5000,
  upiEnabled = false,
  upiBlockThresholdPaise,
}: {
  balancePaise: number;
  dueCommissionPaise: number;
  thresholdPaise?: number;
  upiEnabled?: boolean;
  upiBlockThresholdPaise?: number;
}) {
  const low = balancePaise < thresholdPaise;
  const owes = dueCommissionPaise > 0;
  const upiBlocked =
    upiEnabled &&
    upiBlockThresholdPaise != null &&
    dueCommissionPaise > upiBlockThresholdPaise;
  if (!low && !owes) return null;

  if (upiBlocked) {
    return (
      <div className="mb-6 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
        <strong>Instant UPI confirmation is paused.</strong> You have{" "}
        <strong>{formatRupees(dueCommissionPaise)}</strong> in unpaid commission (over the{" "}
        {formatRupees(upiBlockThresholdPaise)} limit), so new UPI orders are going to your manual
        “Awaiting UPI confirmation” queue. Top up to clear the dues and re-enable instant confirm.{" "}
        <Link href="/wallet" className="font-medium underline">
          Top up →
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
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
