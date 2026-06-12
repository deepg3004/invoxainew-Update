import Link from "next/link";
import { GlassCard } from "@invoxai/ui";
import { listCourses, getSellerGateway } from "@invoxai/db";
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

export default async function CoursesPage() {
  const { tenant } = await requireTenant();
  const [courses, gateway] = await Promise.all([
    listCourses(tenant.id),
    getSellerGateway(tenant.id),
  ]);
  const base = buyerBase(tenant.username);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted">
            InvoxAI · courses
          </p>
          <h1 className="mt-1 text-3xl font-bold">Courses</h1>
        </div>
        {gateway ? (
          <Link
            href="/courses/new"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white"
          >
            New course
          </Link>
        ) : null}
      </div>

      {!gateway ? (
        <div className="mt-8">
          <GlassCard title="Connect a gateway first">
            <p className="text-sm text-muted">
              Buyers pay you directly through your own Razorpay account. Connect it
              before creating courses.
            </p>
            <Link
              href="/gateway"
              className="mt-3 inline-block text-sm font-medium text-cyan underline"
            >
              Connect gateway →
            </Link>
          </GlassCard>
        </div>
      ) : courses.length === 0 ? (
        <p className="mt-8 text-muted">
          No courses yet. Create your first one.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {courses.map((c) => {
            const url = `${base}/c/${c.slug}`;
            return (
              <div key={c.id} className="rounded-xl border border-zinc-200 bg-surface p-4">
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
                        className="mt-1 block truncate text-sm text-cyan underline"
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
                      <Link href={`/courses/${c.id}`} className="text-cyan underline">
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
        </div>
      )}
    </div>
  );
}
