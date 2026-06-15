import { notFound } from "next/navigation";
import { GlassCard, PageHeader } from "@invoxai/ui";
import { getSiteWithPages, listAiPages } from "@invoxai/db";
import { requireTenant } from "../../../lib/tenant";
import { SiteNameForm } from "../SiteNameForm";
import {
  renameSiteAction,
  deleteSiteAction,
  addPageToSiteAction,
  savePageNavAction,
  removePageFromSiteAction,
} from "../actions";

export const dynamic = "force-dynamic";

const inputCls =
  "rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-brand";

export default async function ManageSitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenant } = await requireTenant();
  const { id } = await params;
  const [site, allPages] = await Promise.all([
    getSiteWithPages(tenant.id, id),
    listAiPages(tenant.id),
  ]);
  if (!site) notFound();

  // Pages not yet in any site can be added here (avoid silent cross-site moves).
  const available = allPages.filter((p) => p.siteId === null);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="InvoxAI · builder" title={site.name} />

      <GlassCard title="Rename">
        <SiteNameForm
          action={renameSiteAction.bind(null, site.id)}
          initialName={site.name}
          submitLabel="Save name"
        />
      </GlassCard>

      <GlassCard title="Pages in this site">
        {site.pages.length === 0 ? (
          <p className="text-sm text-muted">No pages yet. Add one below.</p>
        ) : (
          <ul className="space-y-3">
            {site.pages.map((p) => (
              <li key={p.id} className="rounded-lg border border-zinc-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-medium text-zinc-900">{p.title}</span>
                    <span className="ml-2 text-xs text-muted">
                      /{p.slug}
                      {p.isPublished ? "" : " · draft (hidden from nav)"}
                    </span>
                  </div>
                  <form action={removePageFromSiteAction.bind(null, site.id, p.id)}>
                    <button className="shrink-0 text-sm text-muted underline hover:text-red-700">
                      Remove
                    </button>
                  </form>
                </div>
                <form
                  action={savePageNavAction.bind(null, site.id, p.id)}
                  className="mt-2 flex flex-wrap items-end gap-2"
                >
                  <label className="block">
                    <span className="text-xs text-muted">Nav label</span>
                    <input
                      name="navLabel"
                      defaultValue={p.navLabel ?? ""}
                      maxLength={60}
                      placeholder={p.title}
                      className={`mt-0.5 block ${inputCls}`}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-muted">Order</span>
                    <input
                      name="navOrder"
                      inputMode="numeric"
                      defaultValue={p.navOrder}
                      className={`mt-0.5 block w-20 ${inputCls}`}
                    />
                  </label>
                  <button className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:border-brand/40">
                    Save
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      <GlassCard title="Add a page">
        {available.length === 0 ? (
          <p className="text-sm text-muted">
            All your standalone AI pages are already in a site. Create more under AI pages.
          </p>
        ) : (
          <form action={addPageToSiteAction.bind(null, site.id)} className="flex flex-wrap items-center gap-2">
            <select name="pageId" required defaultValue="" className={inputCls}>
              <option value="" disabled>
                Choose a page…
              </option>
              {available.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} (/{p.slug})
                </option>
              ))}
            </select>
            <button className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">
              Add to site
            </button>
          </form>
        )}
      </GlassCard>

      <GlassCard title="Danger zone">
        <form action={deleteSiteAction.bind(null, site.id)}>
          <button className="text-sm text-red-700 underline">Delete this site</button>
        </form>
        <p className="mt-1 text-xs text-muted">
          Pages are kept — they just become standalone again.
        </p>
      </GlassCard>
    </div>
  );
}
