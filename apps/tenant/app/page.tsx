import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Card } from "@invoxai/ui";
import { tenantUsernameFromHost } from "@invoxai/utils/host";
import { getTenantByUsername, getTenantTracking } from "@invoxai/db";
import { StoreUnavailable } from "./StoreUnavailable";
import { TrackingScripts } from "./TrackingScripts";
import { CartLink } from "./CartLink";

// Resolved per-request from the Host header, so never cache.
export const dynamic = "force-dynamic";

export default async function TenantHome() {
  const host = (await headers()).get("host");
  const username = tenantUsernameFromHost(host);

  // Apex / www / reserved host (e.g. plain localhost:3003 in dev): show a hint
  // rather than a 404, since this is the platform host, not a tenant.
  if (!username) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-sm font-medium uppercase tracking-wide text-neutral-400">
          InvoxAI · tenant host
        </p>
        <h1 className="mt-1 text-3xl font-bold">No tenant on this host</h1>
        <p className="mt-2 text-neutral-500">
          Visit a seller subdomain to see their site — e.g.{" "}
          <code className="rounded bg-neutral-100 px-1.5 py-0.5">
            deep.localhost:3003
          </code>{" "}
          in development, or{" "}
          <code className="rounded bg-neutral-100 px-1.5 py-0.5">
            deep.invoxai.io
          </code>{" "}
          in production.
        </p>
      </main>
    );
  }

  const tenant = await getTenantByUsername(username);
  if (!tenant) notFound();
  if (tenant.suspendedAt) return <StoreUnavailable name={tenant.name ?? tenant.username} />;
  const tracking = await getTenantTracking(tenant.id);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <TrackingScripts ids={tracking ?? {}} />
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium uppercase tracking-wide text-neutral-400">
          {tenant.username}.invoxai.io
        </p>
        <div className="flex gap-4">
          <CartLink />
          <Link href="/account" className="text-sm text-blue-600 underline">
            Your orders
          </Link>
        </div>
      </div>
      <h1 className="mt-1 text-3xl font-bold">{tenant.name ?? tenant.username}</h1>

      <div className="mt-8">
        <Card title="This site is live">
          <p>
            Host-based tenant resolution worked: the request to{" "}
            <strong>{host}</strong> resolved to tenant{" "}
            <strong>{tenant.username}</strong>.
          </p>
          <p className="mt-3 flex gap-4">
            <Link href="/store" className="font-medium text-blue-600 underline">
              Visit the store →
            </Link>
            <Link href="/courses" className="font-medium text-blue-600 underline">
              Browse courses →
            </Link>
          </p>
        </Card>
      </div>
    </main>
  );
}
