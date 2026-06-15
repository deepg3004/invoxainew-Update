import { GlassCard, PageHeader } from "@invoxai/ui";
import { getTenantByOwnerId } from "@invoxai/db";
import { requireTenant } from "../../lib/tenant";
import { StorefrontForm } from "./StorefrontForm";
import { BrandingForm } from "./BrandingForm";

export const dynamic = "force-dynamic";

export default async function StorefrontPage() {
  const { user } = await requireTenant();
  const tenant = await getTenantByOwnerId(user.id);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="InvoxAI · store"
        title="Storefront"
        description="Settings for your public storefront."
      />
      <GlassCard className="mt-6" title="Announcement bar">
        <p className="text-sm text-muted">
          A short promo shown across the top of your storefront — sales, launches, or notices.
          Buyers can dismiss it, and editing the message brings it back for everyone.
        </p>
        <div className="mt-4">
          <StorefrontForm
            initial={{
              announcement: tenant?.announcement ?? "",
              announcementLink: tenant?.announcementLink ?? "",
            }}
          />
        </div>
      </GlassCard>

      <GlassCard className="mt-6" title="Branding">
        <p className="text-sm text-muted">
          Your logo, hero banner, brand colour, an About section, footer policy links, and store
          SEO — shown on your public storefront.
        </p>
        <div className="mt-4">
          <BrandingForm
            initial={{
              logoUrl: tenant?.logoUrl ?? "",
              bannerUrl: tenant?.bannerUrl ?? "",
              brandColor: tenant?.brandColor ?? "",
              aboutText: tenant?.aboutText ?? "",
              privacyUrl: tenant?.privacyUrl ?? "",
              refundUrl: tenant?.refundUrl ?? "",
              termsUrl: tenant?.termsUrl ?? "",
              storeMetaTitle: tenant?.storeMetaTitle ?? "",
              storeMetaDescription: tenant?.storeMetaDescription ?? "",
            }}
          />
        </div>
      </GlassCard>
    </div>
  );
}
