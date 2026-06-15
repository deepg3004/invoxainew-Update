import Link from "next/link";
import { Button, GlassCard, PageHeader, Pagination, pageSlice } from "@invoxai/ui";
import { listWorkshops, countWorkshops, seatsRemaining } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { formatDateTimeShortIST } from "@invoxai/utils/date";
import { requireTenant } from "../../lib/tenant";
import { setWorkshopStatusAction } from "./actions";
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

export default async function WorkshopsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; size?: string }>;
}) {
  const { tenant } = await requireTenant();
  const { page: rawPage, size: rawSize } = await searchParams;
  const total = await countWorkshops(tenant.id);
  const { page, totalPages, skip, take, pageSize } = pageSlice(total, rawPage, rawSize);
  const workshops = await listWorkshops(tenant.id, { skip, take });
  const firstOnPage = total === 0 ? 0 : skip + 1;
  const lastOnPage = skip + workshops.length;
  const base = buyerBase(tenant.username);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · workshops"
        title="Workshops"
        description="Sell tickets to a live session (Zoom/Meet) — set a date, seats, and a price. The join link is revealed to registrants after they pay."
        actions={<Button href="/workshops/new">New workshop</Button>}
      />

      {workshops.length === 0 ? (
        <GlassCard className="mt-8">
          <p className="text-sm text-muted">No workshops yet. Create your first one.</p>
        </GlassCard>
      ) : (
        <GlassCard className="mt-6 space-y-3">
          {workshops.map((w) => {
            const url = `${base}/w/${w.slug}`;
            const left = seatsRemaining(w.maxSeats, w._count.registrations);
            return (
              <div key={w.id} className="rounded-xl border border-zinc-100 bg-surface p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-900">{w.title}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_BADGE[w.status] ?? "bg-zinc-100 text-muted"
                        }`}
                      >
                        {w.status.charAt(0) + w.status.slice(1).toLowerCase()}
                      </span>
                    </div>
                    {w.status === "PUBLISHED" ? (
                      <a href={url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-sm text-brand-strong underline">
                        {url}
                      </a>
                    ) : (
                      <span className="mt-1 block truncate text-sm text-muted">/w/{w.slug}</span>
                    )}
                    <span className="mt-1 block text-xs text-muted">
                      {w.scheduledAt ? formatDateTimeShortIST(w.scheduledAt) : "No date set"} ·{" "}
                      {w._count.registrations} registered
                      {left !== null ? ` · ${left} seat${left === 1 ? "" : "s"} left` : ""}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold">{w.pricePaise <= 0 ? "Free" : formatRupees(w.pricePaise)}</div>
                    <div className="mt-1 flex items-center gap-3 text-sm">
                      {w.status === "PUBLISHED" ? <CopyLinkButton url={url} /> : null}
                      <Link href={`/workshops/${w.id}`} className="text-brand-strong underline">
                        Edit
                      </Link>
                      {w.status === "PUBLISHED" ? (
                        <form action={setWorkshopStatusAction.bind(null, w.id, "DRAFT")}>
                          <button className="text-muted underline hover:text-zinc-900">Unpublish</button>
                        </form>
                      ) : w.status === "DRAFT" ? (
                        <form action={setWorkshopStatusAction.bind(null, w.id, "PUBLISHED")}>
                          <button className="text-muted underline hover:text-zinc-900">Publish</button>
                        </form>
                      ) : (
                        <form action={setWorkshopStatusAction.bind(null, w.id, "DRAFT")}>
                          <button className="text-muted underline hover:text-zinc-900">Restore</button>
                        </form>
                      )}
                      {w.status !== "ARCHIVED" ? (
                        <form action={setWorkshopStatusAction.bind(null, w.id, "ARCHIVED")}>
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
          label="workshops"
        />
      ) : null}
    </div>
  );
}
