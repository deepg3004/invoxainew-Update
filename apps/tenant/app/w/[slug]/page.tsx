import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getSellerGateway,
  getEnabledSellerUpi,
  getTenantTracking,
  getPublishedWorkshop,
  getWorkshopRegistration,
  seatsRemaining,
  isSoldOut,
} from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { formatDateTimeShortIST } from "@invoxai/utils/date";
import { resolveTenantByHost } from "../../../lib/resolve";
import { getSessionUser } from "../../../lib/auth";
import { WorkshopJoinBox } from "./WorkshopJoinBox";
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
  const w = await getPublishedWorkshop(tenant.id, slug);
  if (!w) return {};
  const description = w.description?.slice(0, 200) ?? undefined;
  const images = w.imageUrl ? [w.imageUrl] : undefined;
  return {
    title: w.title,
    description,
    openGraph: { title: w.title, description, images, type: "website" },
  };
}

export default async function WorkshopPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) notFound();
  if (tenant.suspendedAt) return <StoreUnavailable name={tenant.name ?? tenant.username} />;

  const { slug } = await params;
  const workshop = await getPublishedWorkshop(tenant.id, slug);
  if (!workshop) notFound();

  const [gateway, upi, tracking, user] = await Promise.all([
    getSellerGateway(tenant.id),
    getEnabledSellerUpi(tenant.id),
    getTenantTracking(tenant.id),
    getSessionUser(),
  ]);
  const razorpayReady = Boolean(gateway && gateway.status === "CONNECTED");
  const isFree = workshop.pricePaise <= 0;
  const sellerReady = isFree || razorpayReady || Boolean(upi);
  const taken = workshop._count.registrations;
  const left = seatsRemaining(workshop.maxSeats, taken);
  const soldOut = isSoldOut(workshop.maxSeats, taken);

  const registration = user
    ? await getWorkshopRegistration({
        tenantId: tenant.id,
        workshopId: workshop.id,
        profileId: user.id,
        email: user.email ?? null,
      })
    : null;

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <TrackingScripts ids={tracking ?? {}} />
      <TrackView name={workshop.title} valuePaise={workshop.pricePaise} />
      <div className="flex items-center justify-between">
        <Link href="/workshops" className="text-sm text-cyan underline">
          ← {tenant.name ?? tenant.username} workshops
        </Link>
        <CartLink />
      </div>

      {workshop.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={workshop.imageUrl}
          alt={workshop.title}
          className="mt-4 aspect-video w-full rounded-xl border border-zinc-200 object-cover"
        />
      ) : null}

      <h1 className="mt-4 text-2xl font-bold">{workshop.title}</h1>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        {workshop.scheduledAt ? (
          <span className="font-medium text-zinc-700">🗓 {formatDateTimeShortIST(workshop.scheduledAt)}</span>
        ) : null}
        {workshop.durationMins ? <span>· {workshop.durationMins} min</span> : null}
        {left !== null ? (
          <span>· {left > 0 ? `${left} seat${left === 1 ? "" : "s"} left` : "Sold out"}</span>
        ) : null}
      </div>
      {workshop.description ? (
        <p className="mt-2 whitespace-pre-line text-muted">{workshop.description}</p>
      ) : null}

      <div id="buybox" className="mt-6 rounded-2xl border border-zinc-200 bg-surface p-6 shadow-card">
        {registration ? (
          <div className="text-center">
            <p className="text-sm font-medium text-green-700">✓ You’re registered.</p>
            <Link
              href={`/account/workshop/${workshop.slug}`}
              className="mt-3 inline-block w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white"
            >
              View workshop →
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-3xl font-bold">
                {isFree ? "Free" : formatRupees(workshop.pricePaise)}
              </span>
              {!isFree &&
              workshop.compareAtPaise != null &&
              workshop.compareAtPaise > workshop.pricePaise ? (
                <>
                  <span className="text-lg text-muted line-through">
                    {formatRupees(workshop.compareAtPaise)}
                  </span>
                  <span className="rounded-full bg-green-50 px-2 py-0.5 text-sm font-medium text-green-700">
                    {Math.round((1 - workshop.pricePaise / workshop.compareAtPaise) * 100)}% off
                  </span>
                </>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-muted">
              {isFree
                ? "Register to get the join link."
                : `Live session · paid securely to ${tenant.name ?? tenant.username}.`}
            </p>
            {sellerReady ? (
              <WorkshopJoinBox
                workshop={{
                  id: workshop.id,
                  slug: workshop.slug,
                  title: workshop.title,
                  pricePaise: workshop.pricePaise,
                }}
                razorpayReady={razorpayReady}
                upi={
                  upi
                    ? { upiId: upi.upiId, payeeName: upi.displayName ?? tenant.name ?? tenant.username }
                    : null
                }
                soldOut={soldOut}
              />
            ) : (
              <p className="mt-5 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
                This seller hasn’t finished setting up payments yet.
              </p>
            )}
          </>
        )}
      </div>

      {sellerReady && !registration && !soldOut && !isFree ? (
        <StickyBuyBar label="Register" offerPaise={workshop.pricePaise} compareAtPaise={workshop.compareAtPaise} />
      ) : null}
    </main>
  );
}
