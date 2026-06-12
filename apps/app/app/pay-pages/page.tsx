import Link from "next/link";
import { Button, GlassCard, PageHeader } from "@invoxai/ui";
import { listPaymentPages, getSellerGateway, getEnabledSellerUpi } from "@invoxai/db";
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
  const [pages, gateway, upi] = await Promise.all([
    listPaymentPages(tenant.id),
    getSellerGateway(tenant.id),
    getEnabledSellerUpi(tenant.id),
  ]);
  const ready = Boolean(gateway) || Boolean(upi);
  const base = buyerBase(tenant.username);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · payment pages"
        title="Payment pages"
        actions={
          ready ? (
            <Button href="/pay-pages/new" size="sm">
              New page
            </Button>
          ) : null
        }
      />

      {!ready ? (
        <div>
          <GlassCard title="Set up payments first">
            <p className="text-sm text-muted">
              Buyers pay you directly — connect your own Razorpay account or add a UPI ID
              before creating payment pages.
            </p>
            <Link
              href="/gateway"
              className="mt-3 inline-block text-sm font-medium text-brand-strong underline"
            >
              Set up payments →
            </Link>
          </GlassCard>
        </div>
      ) : pages.length === 0 ? (
        <GlassCard>
          <p className="text-sm text-muted">
            No payment pages yet. Create your first one.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {pages.map((p) => {
            const url = `${base}/pay/${p.slug}`;
            return (
              <div
                key={p.id}
                className="rounded-xl border border-zinc-200 bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-900">{p.title}</span>
                      {p.isActive ? (
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-muted">
                          Off
                        </span>
                      )}
                    </div>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block truncate text-sm text-brand-strong underline"
                    >
                      {url}
                    </a>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold">{formatRupees(p.amountPaise)}</div>
                    <div className="mt-1 flex items-center gap-3 text-sm">
                      {p.isActive ? <CopyLinkButton url={url} /> : null}
                      <Link href={`/pay-pages/${p.id}`} className="text-brand-strong underline">
                        Edit
                      </Link>
                      <form action={setPaymentPageActiveAction.bind(null, p.id, !p.isActive)}>
                        <button className="text-muted underline hover:text-zinc-900">
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
    </div>
  );
}
