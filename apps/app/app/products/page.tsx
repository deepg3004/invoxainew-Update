import Link from "next/link";
import { Card } from "@invoxai/ui";
import { listProducts, getSellerGateway } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";
import { setProductStatusAction } from "./actions";

export const dynamic = "force-dynamic";

function buyerBase(username: string): string {
  return process.env.NODE_ENV === "development"
    ? `http://${username}.localhost:3003`
    : `https://${username}.invoxai.io`;
}

const STATUS_BADGE: Record<string, string> = {
  PUBLISHED: "bg-green-50 text-green-700",
  DRAFT: "bg-amber-50 text-amber-700",
  ARCHIVED: "bg-neutral-100 text-neutral-500",
};

export default async function ProductsPage() {
  const { tenant } = await requireTenant();
  const [products, gateway] = await Promise.all([
    listProducts(tenant.id),
    getSellerGateway(tenant.id),
  ]);
  const base = buyerBase(tenant.username);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-neutral-400">
            InvoxAI · store
          </p>
          <h1 className="mt-1 text-3xl font-bold">Products</h1>
        </div>
        {gateway ? (
          <Link
            href="/products/new"
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
          >
            New product
          </Link>
        ) : null}
      </div>

      {!gateway ? (
        <div className="mt-8">
          <Card title="Connect a gateway first">
            <p className="text-sm text-neutral-500">
              Buyers pay you directly through your own Razorpay account. Connect it
              before adding products.
            </p>
            <Link
              href="/gateway"
              className="mt-3 inline-block text-sm font-medium text-blue-600 underline"
            >
              Connect gateway →
            </Link>
          </Card>
        </div>
      ) : products.length === 0 ? (
        <p className="mt-8 text-neutral-500">
          No products yet. Add your first one.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {products.map((p) => {
            const url = `${base}/p/${p.slug}`;
            return (
              <div
                key={p.id}
                className="rounded-xl border border-neutral-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-neutral-900">{p.title}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_BADGE[p.status] ?? "bg-neutral-100 text-neutral-500"
                        }`}
                      >
                        {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
                      </span>
                    </div>
                    {p.status === "PUBLISHED" ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block truncate text-sm text-blue-600 underline"
                      >
                        {url}
                      </a>
                    ) : (
                      <span className="mt-1 block truncate text-sm text-neutral-400">
                        /p/{p.slug}
                      </span>
                    )}
                    <span className="mt-1 block text-xs text-neutral-400">
                      {p.kind.charAt(0) + p.kind.slice(1).toLowerCase()} ·{" "}
                      {p.stockQty === null ? "Unlimited stock" : `${p.stockQty} in stock`}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold">{formatRupees(p.pricePaise)}</div>
                    <div className="mt-1 flex items-center gap-3 text-sm">
                      <Link href={`/products/${p.id}`} className="text-blue-600 underline">
                        Edit
                      </Link>
                      {p.status === "PUBLISHED" ? (
                        <form action={setProductStatusAction.bind(null, p.id, "DRAFT")}>
                          <button className="text-neutral-500 underline hover:text-neutral-900">
                            Unpublish
                          </button>
                        </form>
                      ) : p.status === "DRAFT" ? (
                        <form action={setProductStatusAction.bind(null, p.id, "PUBLISHED")}>
                          <button className="text-neutral-500 underline hover:text-neutral-900">
                            Publish
                          </button>
                        </form>
                      ) : (
                        <form action={setProductStatusAction.bind(null, p.id, "DRAFT")}>
                          <button className="text-neutral-500 underline hover:text-neutral-900">
                            Restore
                          </button>
                        </form>
                      )}
                      {p.status !== "ARCHIVED" ? (
                        <form action={setProductStatusAction.bind(null, p.id, "ARCHIVED")}>
                          <button className="text-neutral-400 underline hover:text-red-700">
                            Archive
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
