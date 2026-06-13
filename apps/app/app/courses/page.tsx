import Link from "next/link";
import { Button, GlassCard, PageHeader, Pagination, pageSlice } from "@invoxai/ui";
import { listCourses, countCourses, getSellerGateway } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";
import { setCourseStatusAction } from "./actions";
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

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; size?: string }>;
}) {
  const { tenant } = await requireTenant();
  const { page: rawPage, size: rawSize } = await searchParams;
  const total = await countCourses(tenant.id);
  const { page, totalPages, skip, take, pageSize } = pageSlice(total, rawPage, rawSize);
  const [courses, gateway] = await Promise.all([
    listCourses(tenant.id, { skip, take }),
    getSellerGateway(tenant.id),
  ]);
  const firstOnPage = total === 0 ? 0 : skip + 1;
  const lastOnPage = skip + courses.length;
  const base = buyerBase(tenant.username);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · courses"
        title="Courses"
        actions={
          gateway ? (
            <Button href="/courses/new">New course</Button>
          ) : null
        }
      />

      {!gateway ? (
        <div className="mt-8">
          <GlassCard title="Connect a gateway first">
            <p className="text-sm text-muted">
              Buyers pay you directly through your own Razorpay account. Connect it
              before creating courses.
            </p>
            <Link
              href="/gateway"
              className="mt-3 inline-block text-sm font-medium text-brand-strong underline"
            >
              Connect gateway →
            </Link>
          </GlassCard>
        </div>
      ) : courses.length === 0 ? (
        <GlassCard className="mt-8">
          <p className="text-sm text-muted">No courses yet. Create your first one.</p>
        </GlassCard>
      ) : (
        <GlassCard className="mt-6 space-y-3">
          {courses.map((c) => {
            const url = `${base}/c/${c.slug}`;
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
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block truncate text-sm text-brand-strong underline"
                      >
                        {url}
                      </a>
                    ) : (
                      <span className="mt-1 block truncate text-sm text-muted">/c/{c.slug}</span>
                    )}
                    <span className="mt-1 block text-xs text-muted">
                      {c._count.lessons} lesson{c._count.lessons === 1 ? "" : "s"} ·{" "}
                      {c._count.enrolments} enrolled
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold">{formatRupees(c.pricePaise)}</div>
                    <div className="mt-1 flex items-center gap-3 text-sm">
                      {c.status === "PUBLISHED" ? <CopyLinkButton url={url} /> : null}
                      <Link href={`/courses/${c.id}`} className="text-brand-strong underline">
                        Edit
                      </Link>
                      {c.status === "PUBLISHED" ? (
                        <form action={setCourseStatusAction.bind(null, c.id, "DRAFT")}>
                          <button className="text-muted underline hover:text-zinc-900">
                            Unpublish
                          </button>
                        </form>
                      ) : c.status === "DRAFT" ? (
                        <form action={setCourseStatusAction.bind(null, c.id, "PUBLISHED")}>
                          <button className="text-muted underline hover:text-zinc-900">
                            Publish
                          </button>
                        </form>
                      ) : (
                        <form action={setCourseStatusAction.bind(null, c.id, "DRAFT")}>
                          <button className="text-muted underline hover:text-zinc-900">
                            Restore
                          </button>
                        </form>
                      )}
                      {c.status !== "ARCHIVED" ? (
                        <form action={setCourseStatusAction.bind(null, c.id, "ARCHIVED")}>
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
          label="courses"
        />
      ) : null}
    </div>
  );
}
