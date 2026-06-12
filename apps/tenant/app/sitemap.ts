import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import {
  listPublishedProducts,
  listPublishedCourses,
  listAiPages,
  listPaymentPages,
} from "@invoxai/db";
import { resolveTenantByHost } from "../lib/resolve";

// Per-tenant sitemap: each storefront host gets a /sitemap.xml of its own
// published URLs, so a seller's pages get discovered by search engines. Resolved
// per request from the Host header (subdomain or verified custom domain), so it
// only ever lists the requesting tenant's content — never another seller's.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!host || !tenant) return [];

  const base = `https://${host.split(":")[0]}`;
  const [products, courses, aiPages, payPages] = await Promise.all([
    listPublishedProducts(tenant.id),
    listPublishedCourses(tenant.id),
    listAiPages(tenant.id),
    listPaymentPages(tenant.id),
  ]);

  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly" },
    { url: `${base}/store`, changeFrequency: "weekly" },
    { url: `${base}/courses`, changeFrequency: "weekly" },
  ];
  for (const p of products) {
    entries.push({ url: `${base}/p/${p.slug}`, lastModified: p.updatedAt });
  }
  for (const c of courses) {
    entries.push({ url: `${base}/c/${c.slug}`, lastModified: c.updatedAt });
  }
  for (const a of aiPages) {
    if (a.isPublished) entries.push({ url: `${base}/${a.slug}`, lastModified: a.updatedAt });
  }
  for (const pg of payPages) {
    if (pg.isActive) entries.push({ url: `${base}/pay/${pg.slug}`, lastModified: pg.updatedAt });
  }
  return entries;
}
