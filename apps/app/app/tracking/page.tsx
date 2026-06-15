import { Button, GlassCard, PageHeader } from "@invoxai/ui";
import { getTenantTracking } from "@invoxai/db";
import { requireTenant } from "../../lib/tenant";
import { saveTrackingAction } from "./actions";

export const dynamic = "force-dynamic";

const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand";

export default async function TrackingPage() {
  const { tenant } = await requireTenant();
  const t = await getTenantTracking(tenant.id);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · tracking"
        title="Ads & analytics tracking"
        description="Add your pixel IDs and they’ll fire on your public pages (storefront, payment pages, AI pages) — PageView on load and Purchase on a sale. You build the audiences in Meta/Google; InvoxAI sends the events."
      />

      <GlassCard title="Tracking IDs">
        <form action={saveTrackingAction} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-zinc-900">Meta Pixel ID</span>
            <input name="metaPixelId" defaultValue={t?.metaPixelId ?? ""} placeholder="123456789012345" className={inputCls} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-900">GA4 Measurement ID</span>
            <input name="ga4MeasurementId" defaultValue={t?.ga4MeasurementId ?? ""} placeholder="G-XXXXXXXXXX" className={inputCls} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-900">Google Ads ID</span>
            <input name="googleAdsId" defaultValue={t?.googleAdsId ?? ""} placeholder="AW-XXXXXXXXXX" className={inputCls} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-900">Google Tag Manager ID</span>
            <input name="gtmId" defaultValue={t?.gtmId ?? ""} placeholder="GTM-XXXXXXX" className={inputCls} />
          </label>

          <div className="border-t border-zinc-100 pt-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                name="socialProofEnabled"
                defaultChecked={t?.socialProofEnabled ?? true}
                className="mt-1 h-4 w-4"
              />
              <span className="text-sm">
                <span className="font-medium text-zinc-900">Show recent-purchase popups</span>
                <span className="mt-0.5 block text-xs text-muted">
                  Display live “someone just bought …” social-proof popups on your public
                  pages. Built from your real recent sales and masked — only a first name
                  and the item are ever shown.
                </span>
              </span>
            </label>
          </div>

          <Button type="submit">
            Save tracking
          </Button>
        </form>
      </GlassCard>
    </div>
  );
}
