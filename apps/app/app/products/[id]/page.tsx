import { notFound } from "next/navigation";
import { GlassCard, PageHeader } from "@invoxai/ui";
import { getProductById, listCollections, listProductVariants } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireTenant } from "../../../lib/tenant";
import { ProductForm } from "../ProductForm";
import { updateProductAction, createVariantAction, deleteVariantAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenant } = await requireTenant();
  const { id } = await params;
  const [product, collections, variants] = await Promise.all([
    getProductById(tenant.id, id),
    listCollections(tenant.id),
    listProductVariants(id),
  ]);
  if (!product) notFound();

  const action = updateProductAction.bind(null, product.id);
  const addVariantAction = createVariantAction.bind(null, product.id);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · products"
        title="Edit product"
        description={product.title}
      />
      <GlassCard>
        <ProductForm
          action={action}
          submitLabel="Save changes"
          collections={collections}
          initial={{
            slug: product.slug,
            title: product.title,
            description: product.description,
            pricePaise: product.pricePaise,
            compareAtPaise: product.compareAtPaise,
            bumpEnabled: product.bumpEnabled,
            bumpBlurb: product.bumpBlurb,
            downloadKey: product.downloadKey,
            downloadName: product.downloadName,
            imageUrl: product.imageUrl,
            galleryUrls: product.galleryUrls,
            tags: product.tags,
            metaTitle: product.metaTitle,
            metaDescription: product.metaDescription,
            kind: product.kind,
            stockQty: product.stockQty,
            sortOrder: product.sortOrder,
            collectionId: product.collectionId,
            accessUrl: product.accessUrl,
          }}
        />
      </GlassCard>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-900">Variants</h2>
        <p className="mt-1 text-sm text-muted">
          Optional size/colour options, each with its own price. When set, buyers pick a variant
          at checkout and are charged that variant's price. Variants share this product's stock.
        </p>
        {variants.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {variants.map((v) => (
              <li
                key={v.id}
                className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-surface p-3 text-sm"
              >
                <span className="flex-1 font-medium text-zinc-900">{v.label}</span>
                <span className="text-zinc-900">{formatRupees(v.pricePaise)}</span>
                <form action={deleteVariantAction.bind(null, product.id, v.id)}>
                  <button className="text-xs text-muted underline hover:text-red-700">Delete</button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
        <form action={addVariantAction} className="mt-3 grid grid-cols-[1fr_8rem_auto] items-end gap-2">
          <label className="block">
            <span className="text-xs font-medium text-zinc-700">Label</span>
            <input
              name="label"
              placeholder="Large / Red"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-zinc-700">Price (₹)</span>
            <input
              name="price"
              inputMode="decimal"
              placeholder="999"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand"
            />
          </label>
          <button className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">Add</button>
        </form>
      </section>
    </div>
  );
}
