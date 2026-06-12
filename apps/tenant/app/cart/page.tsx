import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { tenantUsernameFromHost } from "@invoxai/utils/host";
import { getTenantByUsername, getTenantTracking } from "@invoxai/db";
import { StoreUnavailable } from "../StoreUnavailable";
import { TrackingScripts } from "../TrackingScripts";
import { CartView } from "./CartView";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const host = (await headers()).get("host");
  const username = tenantUsernameFromHost(host);
  if (!username) notFound();

  const tenant = await getTenantByUsername(username);
  if (!tenant) notFound();
  if (tenant.suspendedAt) return <StoreUnavailable name={tenant.name ?? tenant.username} />;

  const tracking = await getTenantTracking(tenant.id);

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <TrackingScripts ids={tracking ?? {}} />
      <Link href="/store" className="text-sm text-blue-600 underline">
        ← {tenant.name ?? tenant.username} store
      </Link>
      <h1 className="mt-4 text-2xl font-bold">Your cart</h1>
      <CartView />
    </main>
  );
}
