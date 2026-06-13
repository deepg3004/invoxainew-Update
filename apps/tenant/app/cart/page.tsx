import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getSellerGateway,
  getEnabledSellerUpi,
  getTenantTracking,
  getOrderBumpProduct,
} from "@invoxai/db";
import { StoreUnavailable } from "../StoreUnavailable";
import { TrackingScripts } from "../TrackingScripts";
import { CartView } from "./CartView";
import { resolveTenantByHost } from "../../lib/resolve";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) notFound();
  if (tenant.suspendedAt) return <StoreUnavailable name={tenant.name ?? tenant.username} />;

  const [gateway, upi, tracking, bumpProduct] = await Promise.all([
    getSellerGateway(tenant.id),
    getEnabledSellerUpi(tenant.id),
    getTenantTracking(tenant.id),
    getOrderBumpProduct(tenant.id),
  ]);
  const razorpayReady = Boolean(gateway && gateway.status === "CONNECTED");
  const bump = bumpProduct
    ? {
        id: bumpProduct.id,
        title: bumpProduct.title,
        pricePaise: bumpProduct.pricePaise,
        compareAtPaise: bumpProduct.compareAtPaise,
        imageUrl: bumpProduct.imageUrl,
        blurb: bumpProduct.bumpBlurb,
      }
    : null;

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <TrackingScripts ids={tracking ?? {}} />
      <Link href="/store" className="text-sm text-cyan underline">
        ← {tenant.name ?? tenant.username} store
      </Link>
      <h1 className="mt-4 text-2xl font-bold">Your cart</h1>
      <CartView
        razorpayReady={razorpayReady}
        upi={
          upi
            ? { upiId: upi.upiId, payeeName: upi.displayName ?? tenant.name ?? tenant.username }
            : null
        }
        bump={bump}
      />
    </main>
  );
}
