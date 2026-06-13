import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  getSellerGateway,
  getEnabledSellerUpi,
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

  const [gateway, upi, tracking] = await Promise.all([
    getSellerGateway(tenant.id),
    getEnabledSellerUpi(tenant.id),
    getTenantTracking(tenant.id),
  ]);
  const razorpayReady = Boolean(gateway && gateway.status === "CONNECTED");
  const sellerReady = razorpayReady || Boolean(upi);

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

      {page.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={page.imageUrl}
          alt={page.title}
          className="mt-4 aspect-video w-full rounded-xl border border-zinc-200 object-cover"
        />
      ) : null}

      <div className="mt-6 rounded-xl border border-zinc-200 bg-surface p-6">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-3xl font-bold">{formatRupees(page.amountPaise)}</span>
          {page.compareAtPaise != null && page.compareAtPaise > page.amountPaise ? (
            <>
              <span className="text-lg text-muted line-through">
                {formatRupees(page.compareAtPaise)}
              </span>
              <span className="rounded-full bg-green-50 px-2 py-0.5 text-sm font-medium text-green-700">
                {Math.round((1 - page.amountPaise / page.compareAtPaise) * 100)}% off
              </span>
            </>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-muted">
          Paid securely to {tenant.name ?? tenant.username}.
        </p>

        {sellerReady ? (
          <PayBox
            paymentPageId={page.id}
            title={page.title}
            amountPaise={page.amountPaise}
            razorpayReady={razorpayReady}
            upi={
              upi
                ? { upiId: upi.upiId, payeeName: upi.displayName ?? tenant.name ?? tenant.username }
                : null
            }
          />
        ) : (
          <p className="mt-5 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
            This seller hasn’t finished setting up payments yet.
          </p>
        )}
      </div>
    </main>
  );
}
