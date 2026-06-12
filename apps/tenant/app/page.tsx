import Link from "next/link";
import { headers } from "next/headers";
import {
  getTenantTracking,
  listPublishedProducts,
  listPublishedCourses,
} from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { resolveTenantByHost } from "../lib/resolve";
import { StoreUnavailable } from "./StoreUnavailable";
import { TrackingScripts } from "./TrackingScripts";
import { CartLink } from "./CartLink";

// Resolved per-request from the Host header, so never cache.
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) return {};
  const name = tenant.name ?? tenant.username;
  return {
    title: name,
    description: `Shop products and courses from ${name}.`,
    openGraph: { title: name, description: `Shop products and courses from ${name}.`, type: "website" },
  };
}

export default async function TenantHome() {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);

  // Apex / www / reserved host (e.g. plain localhost:3003 in dev), or an unknown
  // custom domain: show a hint rather than a 404 — this is the platform host.
  if (!tenant) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-sm font-medium uppercase tracking-wide text-muted">
          InvoxAI · tenant host
        </p>
        <h1 className="mt-1 text-3xl font-bold">No tenant on this host</h1>
        <p className="mt-2 text-muted">
          Visit a seller subdomain to see their site — e.g.{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5">
            deep.localhost:3003
          </code>{" "}
          in development, or{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5">
            deep.invoxai.io
          </code>{" "}
          in production.
        </p>
      </main>
    );
  }

  if (tenant.suspendedAt) return <StoreUnavailable name={tenant.name ?? tenant.username} />;

  const [tracking, products, courses] = await Promise.all([
    getTenantTracking(tenant.id),
    listPublishedProducts(tenant.id),
    listPublishedCourses(tenant.id),
  ]);
  const name = tenant.name ?? tenant.username;
  const featuredProducts = products.slice(0, 6);
  const featuredCourses = courses.slice(0, 4);
  const hasContent = products.length > 0 || courses.length > 0;

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <TrackingScripts ids={tracking ?? {}} />
      <header className="flex items-center justify-between border-b border-zinc-200 pb-5">
        <h1 className="text-2xl font-bold text-zinc-900">{name}</h1>
        <div className="flex items-center gap-4 text-sm">
          <CartLink />
          <Link href="/account" className="text-cyan underline">
            Your orders
          </Link>
        </div>
      </header>

      {!hasContent ? (
        <div className="mt-16 text-center">
          <h2 className="text-xl font-semibold text-zinc-900">Welcome to {name}</h2>
          <p className="mt-2 text-muted">New items are on the way — check back soon.</p>
          <Link
            href="/store"
            className="mt-5 inline-block rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white"
          >
            Browse the store
          </Link>
        </div>
      ) : (
        <>
          {featuredProducts.length > 0 ? (
            <section className="mt-10">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-semibold text-zinc-900">Shop</h2>
                <Link href="/store" className="text-sm text-cyan underline">
                  View all →
                </Link>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {featuredProducts.map((p) => (
                  <Link
                    key={p.id}
                    href={`/p/${p.slug}`}
                    className="rounded-xl border border-zinc-200 bg-surface p-3 transition hover:border-brand/40"
                  >
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt={p.title} className="aspect-square w-full rounded-lg border border-zinc-200 object-cover" />
                    ) : (
                      <div className="aspect-square w-full rounded-lg bg-zinc-50" />
                    )}
                    <div className="mt-2 truncate text-sm font-medium text-zinc-900">{p.title}</div>
                    <div className="mt-0.5 font-semibold">{formatRupees(p.pricePaise)}</div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {featuredCourses.length > 0 ? (
            <section className="mt-12">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-semibold text-zinc-900">Courses</h2>
                <Link href="/courses" className="text-sm text-cyan underline">
                  View all →
                </Link>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {featuredCourses.map((c) => (
                  <Link
                    key={c.id}
                    href={`/c/${c.slug}`}
                    className="rounded-xl border border-zinc-200 bg-surface p-3 transition hover:border-brand/40"
                  >
                    {c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.imageUrl} alt={c.title} className="aspect-video w-full rounded-lg border border-zinc-200 object-cover" />
                    ) : (
                      <div className="aspect-video w-full rounded-lg bg-zinc-50" />
                    )}
                    <div className="mt-2 truncate text-sm font-medium text-zinc-900">{c.title}</div>
                    <div className="mt-0.5 font-semibold">{formatRupees(c.pricePaise)}</div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
