import { GlassCard } from "@invoxai/ui";
import { getSellerGateway } from "@invoxai/db";
import { maskKeyId } from "@invoxai/utils/crypto";
import { requireTenant } from "../../lib/tenant";
import { GatewayForm } from "./GatewayForm";
import { disconnectGateway } from "./actions";

export const dynamic = "force-dynamic";

export default async function GatewayPage() {
  const { tenant } = await requireTenant();
  const gateway = await getSellerGateway(tenant.id);

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-muted">
        InvoxAI · payments
      </p>
      <h1 className="mt-1 text-3xl font-bold">Payment gateway</h1>
      <p className="mt-2 text-muted">
        Connect your own Razorpay account. Buyers pay you <strong>directly</strong>
        {" "}— their money settles to your Razorpay account and never passes through
        InvoxAI.
      </p>

      {gateway ? (
        <div className="mt-8">
          <GlassCard title="Connected">
            <div className="flex items-start justify-between gap-4">
              <div className="text-sm">
                <p className="font-medium text-white">
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
                  {new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }).format(gateway.connectedAt)}
                </p>
                {gateway.mode === "TEST" ? (
                  <p className="mt-2 text-xs text-warning">
                    These are test keys — switch to live keys before taking real
                    buyer payments.
                  </p>
                ) : null}
              </div>
              <form action={disconnectGateway}>
                <button className="rounded-lg border border-white/10 px-3 py-1.5 text-sm hover:bg-white/5">
                  Disconnect
                </button>
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
    </div>
  );
}
