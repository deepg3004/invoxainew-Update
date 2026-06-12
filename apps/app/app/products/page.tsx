import Link from "next/link";
import { GlassCard } from "@invoxai/ui";
import { listProducts, getSellerGateway } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";
import { setProductStatusAction } from "./actions";
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
  ARCHIVED: "bg-white/10 text-muted",
};

export default async function ProductsPage() {
  const { tenant } = await requireTenant();
  const [products, gateway] = await Promise.all([
    listProducts(tenant.id),
    getSellerGateway(tenant.id),
  ]);
  const base = buyerBase(tenant.username);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted">
            InvoxAI · store
          </p>
          <h1 className="mt-1 text-3xl font-bold">Products</h1>
        </div>
        {gateway ? (
          <Link
            href="/products/new"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white"
          >
            New product
          </Link>
        ) : null}
      </div>

      {!gateway ? (
        <div className="mt-8">
          <GlassCard title="Connect a gateway first">
            <p className="text-sm text-muted">
              Buyers pay you directly through your own Razorpay account. Connect it
              before adding products.
            </p>
            <Link
              href="/gateway"
              className="mt-3 inline-block text-sm font-medium text-cyan underline"
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
        <div className="mt-6 space-y-3">
          {products.map((p) => {
            const url = `${base}/p/${p.slug}`;
            return (
              <div
                key={p.id}
                className="rounded-xl border border-white/10 bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{p.title}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_BADGE[p.status] ?? "bg-white/10 text-muted"
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
                        className="mt-1 block truncate text-sm text-cyan underline"
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
                      <Link href={`/products/${p.id}`} className="text-cyan underline">
                        Edit
                      </Link>
                      {p.status === "PUBLISHED" ? (
                        <form action={setProductStatusAction.bind(null, p.id, "DRAFT")}>
                          <button className="text-muted underline hover:text-white">
                            Unpublish
                          </button>
                        </form>
                      ) : p.status === "DRAFT" ? (
                        <form action={setProductStatusAction.bind(null, p.id, "PUBLISHED")}>
                          <button className="text-muted underline hover:text-white">
                            Publish
                          </button>
                        </form>
                      ) : (
                        <form action={setProductStatusAction.bind(null, p.id, "DRAFT")}>
                          <button className="text-muted underline hover:text-white">
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
        </div>
      )}
    </div>
  );
}
