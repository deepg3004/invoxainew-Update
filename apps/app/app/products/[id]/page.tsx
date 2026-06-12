import { notFound } from "next/navigation";
import { getProductById } from "@invoxai/db";
import { requireTenant } from "../../../lib/tenant";
import { ProductForm } from "../ProductForm";
import { updateProductAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenant } = await requireTenant();
  const { id } = await params;
  const product = await getProductById(tenant.id, id);
  if (!product) notFound();

  const action = updateProductAction.bind(null, product.id);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold">Edit product</h1>
      <p className="mt-1 text-muted">{product.title}</p>
      <div className="mt-6">
        <ProductForm
          action={action}
          submitLabel="Save changes"
          initial={{
            slug: product.slug,
            title: product.title,
            description: product.description,
            pricePaise: product.pricePaise,
            imageUrl: product.imageUrl,
            kind: product.kind,
            stockQty: product.stockQty,
            sortOrder: product.sortOrder,
            accessUrl: product.accessUrl,
          }}
        />
      </div>
    </div>
  );
}
