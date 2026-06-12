import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  getSellerGateway,
  getTenantTracking,
} from "@invoxai/db";
import { resolveTenantByHost } from "../../../lib/resolve";
import { cachedPaymentPage } from "../../../lib/content";
import { formatRupees } from "@invoxai/utils/money";
import { PayBox } from "./PayBox";
import { StoreUnavailable } from "../../StoreUnavailable";
import { TrackingScripts } from "../../TrackingScripts";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant || tenant.suspendedAt) return {};
  const { slug } = await params;
  const page = await cachedPaymentPage(tenant.id, slug);
  if (!page) return {};
  const description = page.description?.slice(0, 200) ?? undefined;
  return {
    title: page.title,
    description,
    openGraph: { title: page.title, description, type: "website" },
  };
}

export default async function PayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) notFound();
  if (tenant.suspendedAt) return <StoreUnavailable name={tenant.name ?? tenant.username} />;

  const { slug } = await params;
  const page = await cachedPaymentPage(tenant.id, slug);
  if (!page) notFound();

  const gateway = await getSellerGateway(tenant.id);
  const sellerReady = Boolean(gateway && gateway.status === "CONNECTED");
  const tracking = await getTenantTracking(tenant.id);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <TrackingScripts ids={tracking ?? {}} />
      <p className="text-sm font-medium uppercase tracking-wide text-muted">
        {tenant.name ?? tenant.username}
      </p>
      <h1 className="mt-1 text-2xl font-bold">{page.title}</h1>
      {page.description ? (
        <p className="mt-2 text-muted">{page.description}</p>
      ) : null}

      <div className="mt-6 rounded-xl border border-zinc-200 bg-surface p-6">
        <div className="text-3xl font-bold">{formatRupees(page.amountPaise)}</div>
        <p className="mt-1 text-xs text-muted">
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
