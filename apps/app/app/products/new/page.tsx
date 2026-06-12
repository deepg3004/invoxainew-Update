import { requireTenant } from "../../../lib/tenant";
import { ProductForm } from "../ProductForm";
import { createProductAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  await requireTenant();
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold">New product</h1>
      <p className="mt-1 text-muted">
        Add an item to your store. Buyers pay you directly on your own gateway.
      </p>
      <div className="mt-6">
        <ProductForm action={createProductAction} submitLabel="Create product" />
      </div>
    </div>
  );
}
