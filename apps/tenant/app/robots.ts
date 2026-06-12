import type { MetadataRoute } from "next";
import { headers } from "next/headers";

// Per-host robots: let search engines index the seller's public storefront, but
// keep them out of the buyer's private areas (account, cart) and the API. Points
// at this host's own sitemap.
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host");
  const base = host ? `https://${host.split(":")[0]}` : undefined;
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/account", "/cart", "/api/"],
    },
    sitemap: base ? `${base}/sitemap.xml` : undefined,
  };
}
