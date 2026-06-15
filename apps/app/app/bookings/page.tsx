import Link from "next/link";
import { Button, GlassCard, PageHeader, Pagination, pageSlice } from "@invoxai/ui";
import { listBookingTypes, countBookingTypes } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";
import { setBookingTypeStatusAction } from "./actions";
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

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; size?: string }>;
}) {
  const { tenant } = await requireTenant();
  const { page: rawPage, size: rawSize } = await searchParams;
  const total = await countBookingTypes(tenant.id);
  const { page, totalPages, skip, take, pageSize } = pageSlice(total, rawPage, rawSize);
  const types = await listBookingTypes(tenant.id, { skip, take });
  const firstOnPage = total === 0 ? 0 : skip + 1;
  const lastOnPage = skip + types.length;
  const base = buyerBase(tenant.username);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · 1-on-1"
        title="1-on-1 bookings"
        description="Sell consultations or coaching calls — set your times, buyers book a slot and pay. The meeting link is revealed after they pay."
        actions={<Button href="/bookings/new">New 1-on-1</Button>}
      />

      {types.length === 0 ? (
        <GlassCard className="mt-8">
          <p className="text-sm text-muted">No 1-on-1s yet. Create your first one.</p>
        </GlassCard>
      ) : (
        <GlassCard className="mt-6 space-y-3">
          {types.map((t) => {
            const url = `${base}/b/${t.slug}`;
            return (
              <div key={t.id} className="rounded-xl border border-zinc-100 bg-surface p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-900">{t.title}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_BADGE[t.status] ?? "bg-zinc-100 text-muted"
                        }`}
                      >
                        {t.status.charAt(0) + t.status.slice(1).toLowerCase()}
                      </span>
                    </div>
                    {t.status === "PUBLISHED" ? (
                      <a href={url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-sm text-brand-strong underline">
                        {url}
                      </a>
                    ) : (
                      <span className="mt-1 block truncate text-sm text-muted">/b/{t.slug}</span>
                    )}
                    <span className="mt-1 block text-xs text-muted">
                      {t._count.slots} slot{t._count.slots === 1 ? "" : "s"} · {t._count.bookings} booked
                      {t.durationMins ? ` · ${t.durationMins} min` : ""}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold">{formatRupees(t.pricePaise)}</div>
                    <div className="mt-1 flex items-center gap-3 text-sm">
                      {t.status === "PUBLISHED" ? <CopyLinkButton url={url} /> : null}
                      <Link href={`/bookings/${t.id}`} className="text-brand-strong underline">
                        Edit
                      </Link>
                      {t.status === "PUBLISHED" ? (
                        <form action={setBookingTypeStatusAction.bind(null, t.id, "DRAFT")}>
                          <button className="text-muted underline hover:text-zinc-900">Unpublish</button>
                        </form>
                      ) : t.status === "DRAFT" ? (
                        <form action={setBookingTypeStatusAction.bind(null, t.id, "PUBLISHED")}>
                          <button className="text-muted underline hover:text-zinc-900">Publish</button>
                        </form>
                      ) : (
                        <form action={setBookingTypeStatusAction.bind(null, t.id, "DRAFT")}>
                          <button className="text-muted underline hover:text-zinc-900">Restore</button>
                        </form>
                      )}
                      {t.status !== "ARCHIVED" ? (
                        <form action={setBookingTypeStatusAction.bind(null, t.id, "ARCHIVED")}>
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
          label="1-on-1s"
        />
      ) : null}
    </div>
  );
}
