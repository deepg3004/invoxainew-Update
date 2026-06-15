import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { listPublishedCommunities } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { resolveTenantByHost } from "../../lib/resolve";
import { StoreUnavailable } from "../StoreUnavailable";
import { CartLink } from "../CartLink";
import { StoreThemeShell } from "../StoreThemeShell";

export const dynamic = "force-dynamic";

export default async function CommunitiesPage() {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) notFound();
  if (tenant.suspendedAt) return <StoreUnavailable name={tenant.name ?? tenant.username} />;

  const communities = await listPublishedCommunities(tenant.id);

  return (
    <StoreThemeShell storeTheme={tenant.storeTheme} className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-center justify-between">
        <Link href="/store" className="text-sm text-cyan underline">
          ← {tenant.name ?? tenant.username}
        </Link>
        <CartLink />
      </div>
      <h1 className="mt-4 text-3xl font-bold">Communities</h1>

      {communities.length === 0 ? (
        <p className="mt-8 text-muted">No communities yet.</p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {communities.map((c) => (
            <li key={c.id}>
              <Link
                href={`/m/${c.slug}`}
                className="block overflow-hidden rounded-xl border border-zinc-200 bg-surface transition hover:border-brand/40"
              >
                {c.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.imageUrl} alt={c.title} className="aspect-video w-full object-cover" />
                ) : null}
                <div className="p-4">
                  <h2 className="font-semibold text-zinc-900">{c.title}</h2>
                  <p className="mt-1 text-xs text-muted">
                    {c._count.memberships} member{c._count.memberships === 1 ? "" : "s"}
                  </p>
                  <p className="mt-2 text-sm font-bold">
                    {c.pricePaise <= 0 ? "Free" : formatRupees(c.pricePaise)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </StoreThemeShell>
  );
}
