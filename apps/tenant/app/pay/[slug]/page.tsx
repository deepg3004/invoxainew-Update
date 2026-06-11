import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { tenantUsernameFromHost } from "@invoxai/utils/host";
import {
  getTenantByUsername,
  getActivePaymentPage,
  getSellerGateway,
  getTenantTracking,
} from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { PayBox } from "./PayBox";
import { StoreUnavailable } from "../../StoreUnavailable";
import { TrackingScripts } from "../../TrackingScripts";

export const dynamic = "force-dynamic";

export default async function PayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const host = (await headers()).get("host");
  const username = tenantUsernameFromHost(host);
  if (!username) notFound();

  const tenant = await getTenantByUsername(username);
  if (!tenant) notFound();
  if (tenant.suspendedAt) return <StoreUnavailable name={tenant.name ?? tenant.username} />;

  const { slug } = await params;
  const page = await getActivePaymentPage(tenant.id, slug);
  if (!page) notFound();

  const gateway = await getSellerGateway(tenant.id);
  const sellerReady = Boolean(gateway && gateway.status === "CONNECTED");
  const tracking = await getTenantTracking(tenant.id);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <TrackingScripts ids={tracking ?? {}} />
      <p className="text-sm font-medium uppercase tracking-wide text-neutral-400">
        {tenant.name ?? tenant.username}
      </p>
      <h1 className="mt-1 text-2xl font-bold">{page.title}</h1>
      {page.description ? (
        <p className="mt-2 text-neutral-500">{page.description}</p>
      ) : null}

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-6">
        <div className="text-3xl font-bold">{formatRupees(page.amountPaise)}</div>
        <p className="mt-1 text-xs text-neutral-400">
          Paid securely to {tenant.name ?? tenant.username} via Razorpay.
        </p>

        {sellerReady ? (
          <PayBox paymentPageId={page.id} />
        ) : (
          <p className="mt-5 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
            This seller hasn’t finished setting up payments yet.
          </p>
        )}
      </div>
    </main>
  );
}
