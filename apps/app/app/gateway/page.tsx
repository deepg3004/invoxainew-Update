import {formatDateIST} from "@invoxai/utils/date";
import { Button, GlassCard, PageHeader } from "@invoxai/ui";
import { getSellerGateway, getSellerUpi } from "@invoxai/db";
import { maskKeyId } from "@invoxai/utils/crypto";
import { requireTenant } from "../../lib/tenant";
import { GatewayForm } from "./GatewayForm";
import { UpiForm } from "./UpiForm";
import { disconnectGateway, removeUpiAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function GatewayPage() {
  const { tenant } = await requireTenant();
  const [gateway, upi] = await Promise.all([
    getSellerGateway(tenant.id),
    getSellerUpi(tenant.id),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · payments"
        title="Payment gateway"
        description={
          <>
            Connect your own Razorpay account. Buyers pay you <strong>directly</strong>
            {" "}— their money settles to your Razorpay account and never passes through
            InvoxAI.
          </>
        }
      />

      {gateway ? (
        <div className="mt-8">
          <GlassCard title="Connected">
            <div className="flex items-start justify-between gap-4">
              <div className="text-sm">
                <p className="font-medium text-zinc-900">
                  Razorpay · {maskKeyId(gateway.keyId)}
                </p>
                <p className="mt-1 text-muted">
                  Mode:{" "}
                  <span
                    className={
                      gateway.mode === "LIVE"
                        ? "font-semibold text-green-700"
                        : "font-semibold text-warning"
                    }
                  >
                    {gateway.mode}
                  </span>{" "}
                  · connected{" "}
                  {formatDateIST(gateway.connectedAt)}
                </p>
                {gateway.mode === "TEST" ? (
                  <p className="mt-2 text-xs text-warning">
                    These are test keys — switch to live keys before taking real
                    buyer payments.
                  </p>
                ) : null}
              </div>
              <form action={disconnectGateway}>
                <Button type="submit" variant="secondary" size="sm">
                  Disconnect
                </Button>
              </form>
            </div>
          </GlassCard>

          <p className="mt-6 text-sm text-muted">
            Need to change accounts? Disconnect, then connect the new keys.
          </p>
        </div>
      ) : (
        <div className="mt-8 max-w-lg">
          <GatewayForm />
        </div>
      )}

      {/* Manual UPI (alternative rail) */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold text-zinc-900">Manual UPI</h2>
        <p className="mt-1 text-sm text-muted">
          Accept payments via your own UPI ID — buyers pay you directly and submit the
          transaction reference, which you confirm. Works alongside Razorpay or on its own.
        </p>
        <div className="mt-4 max-w-lg">
          <GlassCard>
            {upi ? (
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div className="text-sm">
                    <p className="font-mono font-medium text-zinc-900">{upi.upiId}</p>
                    {upi.displayName ? (
                      <p className="mt-0.5 text-muted">{upi.displayName}</p>
                    ) : null}
                    <p className="mt-1 text-xs">
                      {upi.enabled ? (
                        <span className="font-medium text-green-700">Enabled at checkout</span>
                      ) : (
                        <span className="text-muted">Saved but hidden at checkout</span>
                      )}
                    </p>
                  </div>
                  <form action={removeUpiAction}>
                    <Button type="submit" variant="secondary" size="sm">
                      Remove
                    </Button>
                  </form>
                </div>
                <div className="mt-4 border-t border-zinc-100 pt-4">
                  <UpiForm
                    initial={{ upiId: upi.upiId, displayName: upi.displayName, enabled: upi.enabled }}
                  />
                </div>
              </div>
            ) : (
              <UpiForm />
            )}
          </GlassCard>
          <p className="mt-2 text-xs text-muted">
            Buyer UPI checkout + your confirmation step are rolling out next.
          </p>
        </div>
      </div>
    </div>
  );
}
