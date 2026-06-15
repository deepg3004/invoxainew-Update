import Link from "next/link";
import { GlassCard, PageHeader } from "@invoxai/ui";
import { listSites } from "@invoxai/db";
import { requireTenant } from "../../lib/tenant";
import { SiteNameForm } from "./SiteNameForm";
import { createSiteAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SitesPage() {
  const { tenant } = await requireTenant();
  const sites = await listSites(tenant.id);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · builder"
        title="Sites"
        description="Group several AI pages into one site with a shared top navigation, so visitors can move between them."
      />

      <GlassCard title="New site" className="mb-6">
        <SiteNameForm action={createSiteAction} submitLabel="Create site" placeholder="e.g. My coaching site" />
      </GlassCard>

      {sites.length === 0 ? (
        <GlassCard>
          <p className="text-muted">No sites yet. Create one, then add your AI pages to it.</p>
        </GlassCard>
      ) : (
        <GlassCard className="divide-y divide-zinc-100 p-0">
          {sites.map((s) => (
            <Link
              key={s.id}
              href={`/sites/${s.id}`}
              className="flex items-center justify-between gap-4 p-4 hover:bg-zinc-50"
            >
              <span className="font-medium text-zinc-900">{s.name}</span>
              <span className="text-sm text-muted">
                {s._count.pages} page{s._count.pages === 1 ? "" : "s"} →
              </span>
            </Link>
          ))}
        </GlassCard>
      )}
    </div>
  );
}
