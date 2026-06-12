import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  listPublishedCourses,
  getTenantTracking,
} from "@invoxai/db";
import { resolveTenantByHost } from "../../lib/resolve";
import { formatRupees } from "@invoxai/utils/money";
import { StoreUnavailable } from "../StoreUnavailable";
import { TrackingScripts } from "../TrackingScripts";
import { CartLink } from "../CartLink";

export const dynamic = "force-dynamic";

export default async function CoursesListPage() {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) notFound();
  if (tenant.suspendedAt) return <StoreUnavailable name={tenant.name ?? tenant.username} />;

  const [courses, tracking] = await Promise.all([
    listPublishedCourses(tenant.id),
    getTenantTracking(tenant.id),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <TrackingScripts ids={tracking ?? {}} />
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{tenant.name ?? tenant.username} · Courses</h1>
        <CartLink />
      </div>

      {courses.length === 0 ? (
        <p className="mt-8 text-neutral-500">No courses available yet.</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {courses.map((c) => (
            <Link
              key={c.id}
              href={`/c/${c.slug}`}
              className="rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-900"
            >
              {c.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.imageUrl}
                  alt={c.title}
                  className="aspect-video w-full rounded-lg border border-neutral-100 object-cover"
                />
              ) : (
                <div className="aspect-video w-full rounded-lg bg-neutral-50" />
              )}
              <h2 className="mt-3 font-semibold text-neutral-900">{c.title}</h2>
              <p className="mt-1 text-xs text-neutral-400">
                {c._count.lessons} lesson{c._count.lessons === 1 ? "" : "s"}
              </p>
              <div className="mt-2 font-bold">{formatRupees(c.pricePaise)}</div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
