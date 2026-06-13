import Link from "next/link";
import { Button, GlassCard, PageHeader, Pagination, pageSlice } from "@invoxai/ui";
import { listCommunities, countCommunities } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";
import { setCommunityStatusAction } from "./actions";
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

export default async function CommunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; size?: string }>;
}) {
  const { tenant } = await requireTenant();
  const { page: rawPage, size: rawSize } = await searchParams;
  const total = await countCommunities(tenant.id);
  const { page, totalPages, skip, take, pageSize } = pageSlice(total, rawPage, rawSize);
  const communities = await listCommunities(tenant.id, { skip, take });
  const firstOnPage = total === 0 ? 0 : skip + 1;
  const lastOnPage = skip + communities.length;
  const base = buyerBase(tenant.username);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · communities"
        title="Communities"
        description="Sell or offer free access to a members space — announcements + a private link (Telegram/Discord/WhatsApp)."
        actions={<Button href="/communities/new">New community</Button>}
      />

      {communities.length === 0 ? (
        <GlassCard className="mt-8">
          <p className="text-sm text-muted">No communities yet. Create your first one.</p>
        </GlassCard>
      ) : (
        <GlassCard className="mt-6 space-y-3">
          {communities.map((c) => {
            const url = `${base}/m/${c.slug}`;
            return (
              <div key={c.id} className="rounded-xl border border-zinc-100 bg-surface p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-900">{c.title}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_BADGE[c.status] ?? "bg-zinc-100 text-muted"
                        }`}
                      >
                        {c.status.charAt(0) + c.status.slice(1).toLowerCase()}
                      </span>
                    </div>
                    {c.status === "PUBLISHED" ? (
                      <a href={url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-sm text-brand-strong underline">
                        {url}
                      </a>
                    ) : (
                      <span className="mt-1 block truncate text-sm text-muted">/m/{c.slug}</span>
                    )}
                    <span className="mt-1 block text-xs text-muted">
                      {c._count.memberships} member{c._count.memberships === 1 ? "" : "s"} ·{" "}
                      {c._count.posts} post{c._count.posts === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold">{c.pricePaise <= 0 ? "Free" : formatRupees(c.pricePaise)}</div>
                    <div className="mt-1 flex items-center gap-3 text-sm">
                      {c.status === "PUBLISHED" ? <CopyLinkButton url={url} /> : null}
                      <Link href={`/communities/${c.id}`} className="text-brand-strong underline">
                        Edit
                      </Link>
                      {c.status === "PUBLISHED" ? (
                        <form action={setCommunityStatusAction.bind(null, c.id, "DRAFT")}>
                          <button className="text-muted underline hover:text-zinc-900">Unpublish</button>
                        </form>
                      ) : c.status === "DRAFT" ? (
                        <form action={setCommunityStatusAction.bind(null, c.id, "PUBLISHED")}>
                          <button className="text-muted underline hover:text-zinc-900">Publish</button>
                        </form>
                      ) : (
                        <form action={setCommunityStatusAction.bind(null, c.id, "DRAFT")}>
                          <button className="text-muted underline hover:text-zinc-900">Restore</button>
                        </form>
                      )}
                      {c.status !== "ARCHIVED" ? (
                        <form action={setCommunityStatusAction.bind(null, c.id, "ARCHIVED")}>
                          <button className="text-muted underline hover:text-red-700">Archive</button>
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
      {total > 0 ? (
        <Pagination
          page={page}
          totalPages={totalPages}
          firstOnPage={firstOnPage}
          lastOnPage={lastOnPage}
          total={total}
          pageSize={pageSize}
          label="communities"
        />
      ) : null}
    </div>
  );
}
