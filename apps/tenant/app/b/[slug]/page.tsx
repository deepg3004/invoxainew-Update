import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getSellerGateway,
  getEnabledSellerUpi,
  getTenantTracking,
  getPublishedBookingType,
} from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { resolveTenantByHost } from "../../../lib/resolve";
import { BookingBox } from "./BookingBox";
import { StickyBuyBar } from "../../StickyBuyBar";
import { StoreUnavailable } from "../../StoreUnavailable";
import { TrackingScripts } from "../../TrackingScripts";
import { TrackView } from "../../TrackView";
import { CartLink } from "../../CartLink";

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
  const t = await getPublishedBookingType(tenant.id, slug);
  if (!t) return {};
  const description = t.description?.slice(0, 200) ?? undefined;
  const images = t.imageUrl ? [t.imageUrl] : undefined;
  return { title: t.title, description, openGraph: { title: t.title, description, images, type: "website" } };
}

export default async function BookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) notFound();
  if (tenant.suspendedAt) return <StoreUnavailable name={tenant.name ?? tenant.username} />;

  const { slug } = await params;
  const type = await getPublishedBookingType(tenant.id, slug);
  if (!type) notFound();

  const [gateway, upi, tracking] = await Promise.all([
    getSellerGateway(tenant.id),
    getEnabledSellerUpi(tenant.id),
    getTenantTracking(tenant.id),
  ]);
  const razorpayReady = Boolean(gateway && gateway.status === "CONNECTED");
  const sellerReady = razorpayReady || Boolean(upi);

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <TrackingScripts ids={tracking ?? {}} />
      <TrackView name={type.title} valuePaise={type.pricePaise} />
      <div className="flex items-center justify-between">
        <Link href="/bookings" className="text-sm text-cyan underline">
          ← {tenant.name ?? tenant.username}
        </Link>
        <CartLink />
      </div>

      {type.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={type.imageUrl}
          alt={type.title}
          className="mt-4 aspect-video w-full rounded-xl border border-zinc-200 object-cover"
        />
      ) : null}

      <h1 className="mt-4 text-2xl font-bold">{type.title}</h1>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-muted">
        {type.durationMins ? <span>⏱ {type.durationMins} min session</span> : null}
        <span>· {type.slots.length} time{type.slots.length === 1 ? "" : "s"} open</span>
      </div>
      {type.description ? (
        <p className="mt-2 whitespace-pre-line text-muted">{type.description}</p>
      ) : null}

      <div id="buybox" className="mt-6 rounded-2xl border border-zinc-200 bg-surface p-6 shadow-card">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-3xl font-bold">{formatRupees(type.pricePaise)}</span>
          {type.compareAtPaise != null && type.compareAtPaise > type.pricePaise ? (
            <>
              <span className="text-lg text-muted line-through">{formatRupees(type.compareAtPaise)}</span>
              <span className="rounded-full bg-green-50 px-2 py-0.5 text-sm font-medium text-green-700">
                {Math.round((1 - type.pricePaise / type.compareAtPaise) * 100)}% off
              </span>
            </>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-muted">
          Live 1-on-1 · paid securely to {tenant.name ?? tenant.username}.
        </p>
        {sellerReady ? (
          <BookingBox
            bookingType={{ id: type.id, slug: type.slug, title: type.title, pricePaise: type.pricePaise }}
            slots={type.slots.map((s) => ({ id: s.id, startsAt: s.startsAt.toISOString() }))}
            razorpayReady={razorpayReady}
            upi={upi ? { upiId: upi.upiId, payeeName: upi.displayName ?? tenant.name ?? tenant.username } : null}
          />
        ) : (
          <p className="mt-5 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
            This seller hasn’t finished setting up payments yet.
          </p>
        )}
      </div>

      {sellerReady ? (
        <StickyBuyBar label="Book now" offerPaise={type.pricePaise} compareAtPaise={type.compareAtPaise} />
      ) : null}
    </main>
  );
}
