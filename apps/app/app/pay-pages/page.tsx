import Link from "next/link";
import { Card } from "@invoxai/ui";
import { listPaymentPages, getSellerGateway } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";
import { setPaymentPageActiveAction } from "./actions";
import { CopyLinkButton } from "../components/CopyLinkButton";

export const dynamic = "force-dynamic";

function buyerBase(username: string): string {
  return process.env.NODE_ENV === "development"
    ? `http://${username}.localhost:3003`
    : `https://${username}.invoxai.io`;
}

export default async function PayPagesPage() {
  const { tenant } = await requireTenant();
  const [pages, gateway] = await Promise.all([
    listPaymentPages(tenant.id),
    getSellerGateway(tenant.id),
  ]);
  const base = buyerBase(tenant.username);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-neutral-400">
            InvoxAI · payment pages
          </p>
          <h1 className="mt-1 text-3xl font-bold">Payment pages</h1>
        </div>
        {gateway ? (
          <Link
            href="/pay-pages/new"
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
          >
            New page
          </Link>
        ) : null}
      </div>

      {!gateway ? (
        <div className="mt-8">
          <Card title="Connect a gateway first">
            <p className="text-sm text-neutral-500">
              Buyers pay you directly through your own Razorpay account. Connect it
              before creating payment pages.
            </p>
            <Link
              href="/gateway"
              className="mt-3 inline-block text-sm font-medium text-blue-600 underline"
            >
              Connect gateway →
            </Link>
          </Card>
        </div>
      ) : pages.length === 0 ? (
        <p className="mt-8 text-neutral-500">
          No payment pages yet. Create your first one.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {pages.map((p) => {
            const url = `${base}/pay/${p.slug}`;
            return (
              <div
                key={p.id}
                className="rounded-xl border border-neutral-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-neutral-900">{p.title}</span>
                      {p.isActive ? (
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
                          Off
                        </span>
                      )}
                    </div>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block truncate text-sm text-blue-600 underline"
                    >
                      {url}
                    </a>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold">{formatRupees(p.amountPaise)}</div>
                    <div className="mt-1 flex items-center gap-3 text-sm">
                      {p.isActive ? <CopyLinkButton url={url} /> : null}
                      <Link href={`/pay-pages/${p.id}`} className="text-blue-600 underline">
                        Edit
                      </Link>
                      <form action={setPaymentPageActiveAction.bind(null, p.id, !p.isActive)}>
                        <button className="text-neutral-500 underline hover:text-neutral-900">
                          {p.isActive ? "Turn off" : "Turn on"}
                        </button>
                      </form>
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
