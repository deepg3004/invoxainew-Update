import { GlassCard, PageHeader } from "@invoxai/ui";
import { listFileAssets, tenantStorageBytes } from "@invoxai/db";
import { DEFAULT_STORAGE_BYTES, formatBytes, storageUsagePct } from "@invoxai/utils/bytes";
import { requireTenant } from "../../lib/tenant";
import { MediaManager } from "./MediaManager";

export const dynamic = "force-dynamic";

export default async function MediaPage() {
  const { tenant } = await requireTenant();
  const [assets, used] = await Promise.all([
    listFileAssets(tenant.id),
    tenantStorageBytes(tenant.id),
  ]);
  const limit = DEFAULT_STORAGE_BYTES;
  const pct = storageUsagePct(used, limit);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="InvoxAI · storage"
        title="Media library"
        description="Upload and manage your files — course materials, e-books, images, anything up to 25 MB."
      />

      <GlassCard className="mb-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-zinc-900">Storage used</span>
          <span className="text-sm text-muted">
            {formatBytes(used)} of {formatBytes(limit)}
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        {pct >= 90 ? (
          <p className="mt-2 text-xs text-amber-700">
            You’re almost out of space — delete files or upgrade your plan.
          </p>
        ) : null}
      </GlassCard>

      <GlassCard>
        <MediaManager
          assets={assets.map((a) => ({
            id: a.id,
            name: a.name,
            sizeBytes: a.sizeBytes,
            contentType: a.contentType,
            createdAt: a.createdAt.toISOString(),
          }))}
        />
      </GlassCard>
    </div>
  );
}
