import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  getSellerGateway,
  getEnabledSellerUpi,
  getTenantTracking,
  getRunningExperimentForPage,
} from "@invoxai/db";
import { resolveTenantByHost } from "../../../lib/resolve";
import { cachedPaymentPage } from "../../../lib/content";
import { formatRupees } from "@invoxai/utils/money";
import { PayBox } from "./PayBox";
import { StickyBuyBar } from "../../StickyBuyBar";
import { ThemeStyle, AnimatedBg, BuiltWithBadge } from "../../ThemeRuntime";
import { resolveTheme, normalizeTheme } from "@invoxai/utils/blocks";
import { ExperimentTitle } from "./ExperimentTitle";
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

  const [gateway, upi, tracking, experiment] = await Promise.all([
    getSellerGateway(tenant.id),
    getEnabledSellerUpi(tenant.id),
    getTenantTracking(tenant.id),
    getRunningExperimentForPage(page.id),
  ]);
  const razorpayReady = Boolean(gateway && gateway.status === "CONNECTED");
  const sellerReady = razorpayReady || Boolean(upi);
  const theme = resolveTheme(normalizeTheme({ theme: { preset: tenant.storeTheme || "pure-snow" } }));

  return (
    <div className="iv-page" style={{ background: theme.bg, minHeight: "100vh", position: "relative" }}>
    <ThemeStyle t={theme} />
    <AnimatedBg type={theme.background} />
    <main className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <TrackingScripts ids={tracking ?? {}} />
      <div className="flex items-center gap-2.5">
        {tenant.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tenant.logoUrl} alt={`${tenant.name ?? tenant.username} logo`} className="h-9 w-9 rounded-lg object-cover" />
        ) : null}
        <p className="text-sm font-medium uppercase tracking-wide text-muted">
          {tenant.name ?? tenant.username}
        </p>
      </div>
      {experiment ? (
        <ExperimentTitle
          experiment={experiment}
          aTitle={page.title}
          aDescription={page.description ?? null}
        />
      ) : (
        <>
          <h1 className="mt-1 text-2xl font-bold">{page.title}</h1>
          {page.description ? (
            <p className="mt-2 text-muted">{page.description}</p>
          ) : null}
        </>
      )}

      {page.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={page.imageUrl}
          alt={page.title}
          className="mt-4 aspect-video w-full rounded-xl border border-zinc-200 object-cover"
        />
      ) : null}

      <div id="buybox" className="mt-6 rounded-2xl border border-zinc-200 bg-surface p-6 shadow-card">
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
            experimentId={experiment?.id ?? null}
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

      {sellerReady ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs text-muted">
          <span className="inline-flex items-center gap-1">🔒 Secure checkout</span>
          <span className="inline-flex items-center gap-1">⚡ Instant confirmation</span>
          {razorpayReady ? <span className="inline-flex items-center gap-1">💳 Cards · UPI · Netbanking</span> : null}
        </div>
      ) : null}

      {sellerReady ? (
        <StickyBuyBar label="Pay now" offerPaise={page.amountPaise} compareAtPaise={page.compareAtPaise} />
      ) : null}
    </main>
    <BuiltWithBadge />
    </div>
  );
}
