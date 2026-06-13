import { GlassCard, PageHeader } from "@invoxai/ui";
import { getTenantByOwnerId } from "@invoxai/db";
import { requireTenant } from "../../lib/tenant";
import { StorefrontForm } from "./StorefrontForm";

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
    </div>
  );
}
