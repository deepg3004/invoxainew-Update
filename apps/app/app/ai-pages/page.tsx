import Link from "next/link";
import { GlassCard } from "@invoxai/ui";
import { listAiPages, getWalletByTenant, getFeatureQuota } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";
import { deleteAiPageAction, setAiPagePublishedAction } from "./actions";
import { CopyLinkButton } from "../components/CopyLinkButton";

export const dynamic = "force-dynamic";

function buyerBase(username: string): string {
  return process.env.NODE_ENV === "development"
    ? `http://${username}.localhost:3003`
    : `https://${username}.invoxai.io`;
}

export default async function AiPagesPage() {
  const { tenant } = await requireTenant();
  const [pages, wallet, quota] = await Promise.all([
    listAiPages(tenant.id),
    getWalletByTenant(tenant.id),
    getFeatureQuota(tenant.id, "ai_page"),
  ]);
  const price = quota?.totalPaise ?? 17582;
  const balance = wallet?.balancePaise ?? 0;
  const base = buyerBase(tenant.username);
  const unlimited = quota?.remainingFree === -1;
  const freeLeft = unlimited ? Infinity : (quota?.remainingFree ?? 0);
  const nextIsFree = unlimited || freeLeft > 0;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted">
            InvoxAI · AI pages
          </p>
          <h1 className="mt-1 text-3xl font-bold">AI landing pages</h1>
          <p className="mt-1 text-muted">
            Describe your business and AI writes a published page.{" "}
            {unlimited ? (
              <strong>Unlimited on your plan.</strong>
            ) : nextIsFree ? (
              <strong>{freeLeft} free left this month</strong>
            ) : (
              <>Next page <strong>{formatRupees(price)}</strong> from your wallet.</>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/ai-pages/templates"
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
          >
            Templates
          </Link>
          <Link
            href="/ai-pages/new"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white"
          >
            Generate page
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <GlassCard title="Wallet">
          <p className="text-sm">
            Balance: <strong>{formatRupees(balance)}</strong>
            {!nextIsFree && balance < price ? (
              <>
                {" "}— too low for a paid page ({formatRupees(price)}).{" "}
                <Link href="/wallet" className="text-cyan underline">
                  Top up
                </Link>
              </>
            ) : null}
          </p>
        </GlassCard>
      </div>

      {pages.length === 0 ? (
        <p className="mt-8 text-muted">No AI pages yet. Generate your first one.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {pages.map((p) => {
            const url = `${base}/${p.slug}`;
            return (
              <div key={p.id} className="rounded-xl border border-zinc-200 bg-surface p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-900">{p.title}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.isPublished
                            ? "bg-green-50 text-green-700"
                            : "bg-zinc-100 text-muted"
                        }`}
                      >
                        {p.isPublished ? "Published" : "Hidden"}
                      </span>
                    </div>
                    {p.isPublished ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block truncate text-sm text-cyan underline"
                      >
                        {url}
                      </a>
                    ) : (
                      <span className="mt-1 block truncate text-sm text-muted">/{p.slug}</span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-sm">
                    {p.isPublished ? <CopyLinkButton url={url} /> : null}
                    <Link href={`/ai-pages/${p.id}/edit`} className="text-cyan underline">
                      Edit
                    </Link>
                    <form action={setAiPagePublishedAction.bind(null, p.id, !p.isPublished)}>
                      <button className="text-muted underline hover:text-zinc-900">
                        {p.isPublished ? "Unpublish" : "Publish"}
                      </button>
                    </form>
                    <form action={deleteAiPageAction.bind(null, p.id)}>
                      <button className="text-muted underline hover:text-red-700">
                        Delete
                      </button>
                    </form>
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
