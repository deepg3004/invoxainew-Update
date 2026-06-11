import Link from "next/link";
import { Card } from "@invoxai/ui";
import { listAiPages, getWalletByTenant, getPricingSetting } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";
import { deleteAiPageAction } from "./actions";

export const dynamic = "force-dynamic";

function buyerBase(username: string): string {
  return process.env.NODE_ENV === "development"
    ? `http://${username}.localhost:3003`
    : `https://${username}.invoxai.io`;
}

export default async function AiPagesPage() {
  const { tenant } = await requireTenant();
  const [pages, wallet, setting] = await Promise.all([
    listAiPages(tenant.id),
    getWalletByTenant(tenant.id),
    getPricingSetting("ai_page_price"),
  ]);
  const price = setting?.valuePaise ?? 14900;
  const balance = wallet?.balancePaise ?? 0;
  const base = buyerBase(tenant.username);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-neutral-400">
            InvoxAI · AI pages
          </p>
          <h1 className="mt-1 text-3xl font-bold">AI landing pages</h1>
          <p className="mt-1 text-neutral-500">
            Describe your business and AI writes a published page —{" "}
            <strong>{formatRupees(price)}</strong> each, from your wallet.
          </p>
        </div>
        <Link
          href="/ai-pages/new"
          className="shrink-0 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          Generate page
        </Link>
      </div>

      <div className="mt-6">
        <Card title="Wallet">
          <p className="text-sm">
            Balance: <strong>{formatRupees(balance)}</strong>
            {balance < price ? (
              <>
                {" "}— too low for a page.{" "}
                <Link href="/wallet" className="text-blue-600 underline">
                  Top up
                </Link>
              </>
            ) : null}
          </p>
        </Card>
      </div>

      {pages.length === 0 ? (
        <p className="mt-8 text-neutral-500">No AI pages yet. Generate your first one.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {pages.map((p) => {
            const url = `${base}/${p.slug}`;
            return (
              <div key={p.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium text-neutral-900">{p.title}</div>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block truncate text-sm text-blue-600 underline"
                    >
                      {url}
                    </a>
                  </div>
                  <form action={deleteAiPageAction.bind(null, p.id)} className="shrink-0">
                    <button className="text-sm text-neutral-500 underline hover:text-red-700">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
