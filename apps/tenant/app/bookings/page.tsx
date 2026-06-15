import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { listPublishedBookingTypes, getTenantTracking } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { resolveTenantByHost } from "../../lib/resolve";
import { StoreUnavailable } from "../StoreUnavailable";
import { TrackingScripts } from "../TrackingScripts";
import { CartLink } from "../CartLink";
import { StoreThemeShell } from "../StoreThemeShell";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  const name = tenant ? (tenant.name ?? tenant.username) : "Bookings";
  return { title: `Book a 1-on-1 · ${name}` };
}

export default async function BookingsListPage() {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) notFound();
  if (tenant.suspendedAt) return <StoreUnavailable name={tenant.name ?? tenant.username} />;

  const [types, tracking] = await Promise.all([
    listPublishedBookingTypes(tenant.id),
    getTenantTracking(tenant.id),
  ]);

  return (
    <StoreThemeShell storeTheme={tenant.storeTheme} className="mx-auto max-w-4xl px-6 py-12">
      <TrackingScripts ids={tracking ?? {}} />
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{tenant.name ?? tenant.username} — Book a 1-on-1</h1>
        <CartLink />
      </div>

      {types.length === 0 ? (
        <p className="mt-8 text-muted">No sessions available yet. Check back soon.</p>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {types.map((t) => (
            <Link
              key={t.id}
              href={`/b/${t.slug}`}
              className="group flex flex-col rounded-2xl border border-zinc-200 bg-surface p-4 no-underline transition duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-card"
            >
              {t.imageUrl ? (
                <div className="overflow-hidden rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.imageUrl} alt={t.title} className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                </div>
              ) : null}
              <div className="mt-3 font-medium text-zinc-900">{t.title}</div>
              {t.durationMins ? <div className="mt-0.5 text-xs text-muted">⏱ {t.durationMins} min</div> : null}
              <div className="mt-1 text-sm font-semibold text-brand-strong">{formatRupees(t.pricePaise)}</div>
            </Link>
          ))}
        </div>
      )}
    </StoreThemeShell>
  );
}
