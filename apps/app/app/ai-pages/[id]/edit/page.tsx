import { notFound } from "next/navigation";
import {
  getAiPageForOwner,
  listAiPageVersions,
  listProducts,
  listCourses,
  listLeadForms,
  listPaymentPages,
  listCollections,
} from "@invoxai/db";
import { normalizeToBlocks } from "@invoxai/utils/blocks";
import { requireTenant } from "../../../../lib/tenant";
import { PageEditor, type EntityOptions } from "./PageEditor";
import { VersionHistory } from "./VersionHistory";

export const dynamic = "force-dynamic";

function buyerBase(username: string): string {
  return process.env.NODE_ENV === "development"
    ? `http://${username}.localhost:3003`
    : `https://${username}.invoxai.io`;
}

export default async function EditAiPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenant } = await requireTenant();
  const { id } = await params;
  const page = await getAiPageForOwner(tenant.id, id);
  if (!page) notFound();

  const content = normalizeToBlocks(page.content);
  const liveUrl = `${buyerBase(tenant.username)}/${page.slug}`;
  // Entity-widget pickers: the seller's catalog, mapped to {id,title} options.
  const [versions, products, courses, forms, pages, collections] = await Promise.all([
    listAiPageVersions(tenant.id, page.id),
    listProducts(tenant.id),
    listCourses(tenant.id),
    listLeadForms(tenant.id),
    listPaymentPages(tenant.id),
    listCollections(tenant.id),
  ]);
  const opt = (rows: { id: string; title: string }[]) => rows.map((r) => ({ id: r.id, title: r.title }));
  const entities: EntityOptions = {
    products: opt(products),
    courses: opt(courses),
    forms: opt(forms),
    pages: opt(pages),
    collections: opt(collections),
  };

  return (
    <>
      {/* key by updatedAt so a Restore (which redirects back) remounts the editor
          with the restored content instead of keeping stale local state. */}
      <PageEditor
        key={page.updatedAt.getTime()}
        pageId={page.id}
        slug={page.slug}
        liveUrl={liveUrl}
        initialTitle={content.title}
        initialBlocks={content.blocks}
        initialTheme={content.theme}
        initialSeo={content.seo ?? { metaTitle: "", description: "", ogImage: "" }}
        entities={entities}
      />
      <VersionHistory pageId={page.id} versions={versions} />
    </>
  );
}
