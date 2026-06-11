import { getTenantTracking } from "@invoxai/db";
import { requireTenant } from "../../lib/tenant";
import { saveTrackingAction } from "./actions";

export const dynamic = "force-dynamic";

const inputCls =
  "mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm outline-none focus:border-neutral-900";

export default async function TrackingPage() {
  const { tenant } = await requireTenant();
  const t = await getTenantTracking(tenant.id);

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-neutral-400">
        InvoxAI · tracking
      </p>
      <h1 className="mt-1 text-3xl font-bold">Ads & analytics tracking</h1>
      <p className="mt-2 text-neutral-500">
        Add your pixel IDs and they’ll fire on your public pages (storefront,
        payment pages, AI pages) — PageView on load and Purchase on a sale. You
        build the audiences in Meta/Google; InvoxAI sends the events.
      </p>

      <form action={saveTrackingAction} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-neutral-700">Meta Pixel ID</span>
          <input name="metaPixelId" defaultValue={t?.metaPixelId ?? ""} placeholder="123456789012345" className={inputCls} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-neutral-700">GA4 Measurement ID</span>
          <input name="ga4MeasurementId" defaultValue={t?.ga4MeasurementId ?? ""} placeholder="G-XXXXXXXXXX" className={inputCls} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-neutral-700">Google Ads ID</span>
          <input name="googleAdsId" defaultValue={t?.googleAdsId ?? ""} placeholder="AW-XXXXXXXXXX" className={inputCls} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-neutral-700">Google Tag Manager ID</span>
          <input name="gtmId" defaultValue={t?.gtmId ?? ""} placeholder="GTM-XXXXXXX" className={inputCls} />
        </label>
        <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
          Save tracking
        </button>
      </form>
    </main>
  );
}
