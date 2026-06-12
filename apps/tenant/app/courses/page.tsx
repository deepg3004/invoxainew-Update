import type { Metadata } from "next";
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

export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  const name = tenant ? (tenant.name ?? tenant.username) : "Courses";
  return { title: `Courses · ${name}` };
}

export default async function CoursesListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) notFound();
  if (tenant.suspendedAt) return <StoreUnavailable name={tenant.name ?? tenant.username} />;

  const [courses, tracking, { q: rawQ }] = await Promise.all([
    listPublishedCourses(tenant.id),
    getTenantTracking(tenant.id),
    searchParams,
  ]);

  const q = (rawQ ?? "").trim();
  const needle = q.toLowerCase();
  const filtered = q
    ? courses.filter(
        (c) =>
          c.title.toLowerCase().includes(needle) ||
          (c.description?.toLowerCase().includes(needle) ?? false),
      )
    : courses;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <TrackingScripts ids={tracking ?? {}} />
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{tenant.name ?? tenant.username} · Courses</h1>
        <CartLink />
      </div>

      {courses.length === 0 ? (
        <p className="mt-8 text-muted">No courses available yet.</p>
      ) : (
        <>
          <form className="mt-6 flex gap-2">
            <input
              name="q"
              defaultValue={q}
              placeholder="Search courses"
              className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <button className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">
              Search
            </button>
            {q ? (
              <Link href="/courses" className="flex items-center px-2 text-sm text-muted underline">
                Clear
              </Link>
            ) : null}
          </form>

          {filtered.length === 0 ? (
            <p className="mt-8 text-muted">
              No courses match “{q}”.{" "}
              <Link href="/courses" className="text-cyan underline">
                Show all
              </Link>
            </p>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/c/${c.slug}`}
              className="rounded-xl border border-white/10 bg-surface p-4 transition hover:border-brand/40"
            >
              {c.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.imageUrl}
                  alt={c.title}
                  className="aspect-video w-full rounded-lg border border-white/10 object-cover"
                />
              ) : (
                <div className="aspect-video w-full rounded-lg bg-white/5" />
              )}
              <h2 className="mt-3 font-semibold text-white">{c.title}</h2>
              <p className="mt-1 text-xs text-muted">
                {c._count.lessons} lesson{c._count.lessons === 1 ? "" : "s"}
              </p>
              <div className="mt-2 font-bold">{formatRupees(c.pricePaise)}</div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
