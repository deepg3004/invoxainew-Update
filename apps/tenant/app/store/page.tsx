import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { tenantUsernameFromHost } from "@invoxai/utils/host";
import {
  getTenantByUsername,
  listPublishedProducts,
  getTenantTracking,
} from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { StoreUnavailable } from "../StoreUnavailable";
import { TrackingScripts } from "../TrackingScripts";

export const dynamic = "force-dynamic";

export default async function StorePage() {
  const host = (await headers()).get("host");
  const username = tenantUsernameFromHost(host);
  if (!username) notFound();

  const tenant = await getTenantByUsername(username);
  if (!tenant) notFound();
  if (tenant.suspendedAt) return <StoreUnavailable name={tenant.name ?? tenant.username} />;

  const [products, tracking] = await Promise.all([
    listPublishedProducts(tenant.id),
    getTenantTracking(tenant.id),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <TrackingScripts ids={tracking ?? {}} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-neutral-400">
            {tenant.username}.invoxai.io
          </p>
          <h1 className="mt-1 text-3xl font-bold">{tenant.name ?? tenant.username}</h1>
        </div>
        <Link href="/account" className="text-sm text-blue-600 underline">
          Your orders
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="mt-8 text-neutral-500">No products yet. Check back soon.</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/p/${p.slug}`}
              className="group rounded-xl border border-neutral-200 bg-white p-4 hover:border-neutral-900"
            >
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.imageUrl}
                  alt={p.title}
                  className="aspect-square w-full rounded-lg border border-neutral-100 object-cover"
                />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-neutral-50 text-neutral-300">
                  No image
                </div>
              )}
              <div className="mt-3 font-medium text-neutral-900 group-hover:underline">
                {p.title}
              </div>
              <div className="mt-0.5 text-sm text-neutral-500">
                {formatRupees(p.pricePaise)}
                {p.stockQty === 0 ? (
                  <span className="ml-2 text-xs font-medium text-red-600">Sold out</span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
