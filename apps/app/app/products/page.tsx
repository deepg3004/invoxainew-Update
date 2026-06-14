import Link from "next/link";
import { Button, GlassCard, PageHeader, Pagination, pageSlice } from "@invoxai/ui";
import { listProducts, countProducts, getSellerGateway, listCollections } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";
import {
  setProductStatusAction,
  createCollectionAction,
  renameCollectionAction,
  deleteCollectionAction,
} from "./actions";
import { CopyLinkButton } from "../components/CopyLinkButton";

export const dynamic = "force-dynamic";

function buyerBase(username: string): string {
  return process.env.NODE_ENV === "development"
    ? `http://${username}.localhost:3003`
    : `https://${username}.invoxai.io`;
}

const STATUS_BADGE: Record<string, string> = {
  PUBLISHED: "bg-green-50 text-green-700",
  DRAFT: "bg-amber-50 text-amber-700",
  ARCHIVED: "bg-zinc-100 text-muted",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; size?: string }>;
}) {
  const { tenant } = await requireTenant();
  const { page: rawPage, size: rawSize } = await searchParams;
  const total = await countProducts(tenant.id);
  const { page, totalPages, skip, take, pageSize } = pageSlice(total, rawPage, rawSize);
  const [products, gateway, collections] = await Promise.all([
    listProducts(tenant.id, { skip, take }),
    getSellerGateway(tenant.id),
    listCollections(tenant.id),
  ]);
  const firstOnPage = total === 0 ? 0 : skip + 1;
  const lastOnPage = skip + products.length;
  const base = buyerBase(tenant.username);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · store"
        title="Products"
        actions={
          gateway ? (
            <Button href="/products/new">New product</Button>
          ) : null
        }
      />

      {gateway ? (
        <details className="mt-4 rounded-xl border border-zinc-200 bg-surface p-4">
          <summary className="cursor-pointer text-sm font-medium text-zinc-900">
            Collections ({collections.length})
          </summary>
          <p className="mt-2 text-sm text-muted">
            Group products into storefront categories. Assign a product to a collection on its
            edit page.
          </p>
          {collections.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {collections.map((c) => (
                <li key={c.id} className="flex items-center gap-2 rounded-lg border border-zinc-200 p-2">
                  <form action={renameCollectionAction.bind(null, c.id)} className="flex flex-1 items-center gap-2">
                    <input
                      name="title"
                      defaultValue={c.title}
                      className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-brand"
                    />
                    <button className="rounded-md px-2 py-1 text-xs text-brand-strong underline">Rename</button>
                  </form>
                  <form action={deleteCollectionAction.bind(null, c.id)}>
                    <button className="text-xs text-muted underline hover:text-red-700">Delete</button>
                  </form>
                </li>
              ))}
            </ul>
          ) : null}
          <form action={createCollectionAction} className="mt-3 flex gap-2">
            <input
              name="title"
              placeholder="New collection (e.g. Ebooks)"
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand"
            />
            <button className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">Add</button>
          </form>
        </details>
      ) : null}

      {!gateway ? (
        <div className="mt-8">
          <GlassCard title="Connect a gateway first">
            <p className="text-sm text-muted">
              Buyers pay you directly through your own Razorpay account. Connect it
              before adding products.
            </p>
            <Link
              href="/gateway"
              className="mt-3 inline-block text-sm font-medium text-brand-strong underline"
            >
              Connect gateway →
            </Link>
          </GlassCard>
        </div>
      ) : products.length === 0 ? (
        <p className="mt-8 text-muted">
          No products yet. Add your first one.
        </p>
      ) : (
        <GlassCard className="mt-6 space-y-3 p-3">
          {products.map((p) => {
            const url = `${base}/p/${p.slug}`;
            return (
              <div
                key={p.id}
                className="rounded-xl border border-zinc-200 bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-900">{p.title}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_BADGE[p.status] ?? "bg-zinc-100 text-muted"
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
                        className="mt-1 block truncate text-sm text-brand-strong underline"
                      >
                        {url}
                      </a>
                    ) : (
                      <span className="mt-1 block truncate text-sm text-muted">
                        /p/{p.slug}
                      </span>
                    )}
                    <span className="mt-1 block text-xs text-muted">
                      {p.kind.charAt(0) + p.kind.slice(1).toLowerCase()} ·{" "}
                      {p.stockQty === null ? "Unlimited stock" : `${p.stockQty} in stock`}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold">{formatRupees(p.pricePaise)}</div>
                    <div className="mt-1 flex items-center gap-3 text-sm">
                      {p.status === "PUBLISHED" ? <CopyLinkButton url={url} /> : null}
                      <Link href={`/products/${p.id}`} className="text-brand-strong underline">
                        Edit
                      </Link>
                      {p.status === "PUBLISHED" ? (
                        <form action={setProductStatusAction.bind(null, p.id, "DRAFT")}>
                          <button className="text-muted underline hover:text-zinc-900">
                            Unpublish
                          </button>
                        </form>
                      ) : p.status === "DRAFT" ? (
                        <form action={setProductStatusAction.bind(null, p.id, "PUBLISHED")}>
                          <button className="text-muted underline hover:text-zinc-900">
                            Publish
                          </button>
                        </form>
                      ) : (
                        <form action={setProductStatusAction.bind(null, p.id, "DRAFT")}>
                          <button className="text-muted underline hover:text-zinc-900">
                            Restore
                          </button>
                        </form>
                      )}
                      {p.status !== "ARCHIVED" ? (
                        <form action={setProductStatusAction.bind(null, p.id, "ARCHIVED")}>
                          <button className="text-muted underline hover:text-red-700">
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
        </GlassCard>
      )}
      {gateway && total > 0 ? (
        <Pagination
          page={page}
          totalPages={totalPages}
          firstOnPage={firstOnPage}
          lastOnPage={lastOnPage}
          total={total}
          pageSize={pageSize}
          label="products"
        />
      ) : null}
    </div>
  );
}
