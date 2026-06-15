import { prisma } from "./client";

/**
 * Builder (multi-page) — sites group AiPages under a shared nav. db layer.
 *
 * A page keeps its own slug + public URL; a site only links siblings together. All
 * seller reads/writes are tenant-scoped; page↔site assignment re-checks that BOTH the
 * page and the site belong to the caller's tenant, so a forged id can't move another
 * tenant's page or attach to another tenant's site. No money path.
 */

export interface SiteNavItem {
  slug: string;
  label: string;
}

export async function createSite(tenantId: string, name: string): Promise<string> {
  const row = await prisma.builderSite.create({
    data: { tenantId, name },
    select: { id: true },
  });
  return row.id;
}

/** A tenant's sites with page counts, newest first. Scoped. */
export function listSites(tenantId: string) {
  return prisma.builderSite.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { pages: true } } },
  });
}

/** One site with its ordered pages (for the manage view). Scoped. */
export function getSiteWithPages(tenantId: string, id: string) {
  return prisma.builderSite.findFirst({
    where: { id, tenantId },
    include: {
      pages: {
        orderBy: [{ navOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, slug: true, title: true, navLabel: true, navOrder: true, isPublished: true },
      },
    },
  });
}

export function renameSite(tenantId: string, id: string, name: string) {
  return prisma.builderSite.updateMany({ where: { id, tenantId }, data: { name } });
}

/** Delete a site. Pages are detached (siteId → null via the FK), never deleted. */
export function deleteSite(tenantId: string, id: string) {
  return prisma.builderSite.deleteMany({ where: { id, tenantId } });
}

/**
 * Assign a page to a site (or detach when siteId is null), setting its nav label +
 * order. Re-checks tenant ownership of the page AND the target site. Returns false if
 * either isn't the caller's.
 */
export async function assignPageToSite(
  tenantId: string,
  pageId: string,
  input: { siteId: string | null; navLabel?: string | null; navOrder?: number },
): Promise<boolean> {
  const page = await prisma.aiPage.findFirst({ where: { id: pageId, tenantId }, select: { id: true } });
  if (!page) return false;
  if (input.siteId) {
    const site = await prisma.builderSite.findFirst({
      where: { id: input.siteId, tenantId },
      select: { id: true },
    });
    if (!site) return false;
  }
  await prisma.aiPage.updateMany({
    where: { id: pageId, tenantId },
    data: {
      siteId: input.siteId,
      navLabel: input.siteId ? input.navLabel ?? null : null,
      navOrder: input.siteId ? input.navOrder ?? 0 : 0,
    },
  });
  return true;
}

/**
 * The shared-nav items for a site's PUBLISHED pages (public render). Keyed by site id
 * only (the page being viewed already proved the tenant). Ordered by navOrder. The
 * label falls back to the page title when no navLabel is set.
 */
export async function getSiteNav(siteId: string): Promise<SiteNavItem[]> {
  const pages = await prisma.aiPage.findMany({
    where: { siteId, isPublished: true },
    orderBy: [{ navOrder: "asc" }, { createdAt: "asc" }],
    select: { slug: true, title: true, navLabel: true },
  });
  return pages.map((p) => ({ slug: p.slug, label: p.navLabel?.trim() || p.title }));
}
