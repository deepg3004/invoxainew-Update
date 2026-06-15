import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getSellerGateway,
  getEnabledSellerUpi,
  getTenantTracking,
  getPublishedCommunity,
  getMembership,
} from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { resolveTheme, normalizeTheme } from "@invoxai/utils/blocks";
import { resolveTenantByHost } from "../../../lib/resolve";
import { getSessionUser } from "../../../lib/auth";
import { CommunityJoinBox } from "./CommunityJoinBox";
import { ThemeStyle, AnimatedBg, BuiltWithBadge } from "../../ThemeRuntime";
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
  const c = await getPublishedCommunity(tenant.id, slug);
  if (!c) return {};
  const description = c.description?.slice(0, 200) ?? undefined;
  const images = c.imageUrl ? [c.imageUrl] : undefined;
  return {
    title: c.title,
    description,
    openGraph: { title: c.title, description, images, type: "website" },
  };
}

export default async function CommunityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) notFound();
  if (tenant.suspendedAt) return <StoreUnavailable name={tenant.name ?? tenant.username} />;

  const { slug } = await params;
  const community = await getPublishedCommunity(tenant.id, slug);
  if (!community) notFound();

  const [gateway, upi, tracking, user] = await Promise.all([
    getSellerGateway(tenant.id),
    getEnabledSellerUpi(tenant.id),
    getTenantTracking(tenant.id),
    getSessionUser(),
  ]);
  const razorpayReady = Boolean(gateway && gateway.status === "CONNECTED");
  const isFree = community.pricePaise <= 0;
  const sellerReady = isFree || razorpayReady || Boolean(upi);

  const membership = user
    ? await getMembership({
        tenantId: tenant.id,
        communityId: community.id,
        profileId: user.id,
        email: user.email ?? null,
      })
    : null;
  const theme = resolveTheme(normalizeTheme({ theme: { preset: tenant.storeTheme || "pure-snow" } }));

  return (
    <div className="iv-page" style={{ background: theme.bg, minHeight: "100vh", position: "relative" }}>
    <ThemeStyle t={theme} />
    <AnimatedBg type={theme.background} />
    <main className="relative z-10 mx-auto max-w-md px-6 py-12">
      <TrackingScripts ids={tracking ?? {}} />
      <TrackView name={community.title} valuePaise={community.pricePaise} />
      <div className="flex items-center justify-between">
        <Link href="/communities" className="text-sm text-cyan underline">
          ← {tenant.name ?? tenant.username} communities
        </Link>
        <CartLink />
      </div>

      {community.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={community.imageUrl}
          alt={community.title}
          className="mt-4 aspect-video w-full rounded-xl border border-zinc-200 object-cover"
        />
      ) : null}

      <h1 className="mt-4 text-2xl font-bold">{community.title}</h1>
      <p className="mt-1 text-sm text-muted">
        {community._count.memberships} member{community._count.memberships === 1 ? "" : "s"}
        {community._count.posts > 0
          ? ` · ${community._count.posts} post${community._count.posts === 1 ? "" : "s"}`
          : ""}
      </p>
      {community.description ? (
        <p className="mt-2 whitespace-pre-line text-muted">{community.description}</p>
      ) : null}

      <div className="mt-6 rounded-xl border border-zinc-200 bg-surface p-6">
        {membership ? (
          <div className="text-center">
            <p className="text-sm font-medium text-green-700">✓ You’re a member.</p>
            <Link
              href={`/account/community/${community.slug}`}
              className="mt-3 inline-block w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white"
            >
              Enter community →
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-3xl font-bold">
                {isFree ? "Free" : formatRupees(community.pricePaise)}
              </span>
              {!isFree &&
              community.compareAtPaise != null &&
              community.compareAtPaise > community.pricePaise ? (
                <>
                  <span className="text-lg text-muted line-through">
                    {formatRupees(community.compareAtPaise)}
                  </span>
                  <span className="rounded-full bg-green-50 px-2 py-0.5 text-sm font-medium text-green-700">
                    {Math.round((1 - community.pricePaise / community.compareAtPaise) * 100)}% off
                  </span>
                </>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-muted">
              {isFree
                ? "Join to access the members area."
                : `Members access · paid securely to ${tenant.name ?? tenant.username}.`}
            </p>
            {sellerReady ? (
              <CommunityJoinBox
                community={{
                  id: community.id,
                  slug: community.slug,
                  title: community.title,
                  pricePaise: community.pricePaise,
                }}
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
          </>
        )}
      </div>
    </main>
    <BuiltWithBadge />
    </div>
  );
}
